"""Server token storage for authorization.

Server tokens are opaque UUIDs that authorize a user to perform operations
on a specific server. This module stores token metadata and handles one-time
use enforcement by deleting tokens when they are consumed.

Tokens are stored in-memory intentionally:
- Fail closed: Hub restart invalidates all tokens (security feature)
- Simple: No external dependencies
- Fast: Dict lookup is O(1)
- Scale: ~500 tokens × ~100 bytes = ~50KB (trivial)
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class ServerTokenData:
    """Data associated with a server token."""

    user_id: str
    server_id: str
    expires_at: datetime


class TokenStore:
    """Stores server tokens for authorization.

    Tokens are opaque UUIDs. When a server asks Hub to authorize a request,
    Hub looks up the token, retrieves the user/server info, and deletes
    the token (one-time use).

    Thread-safe via asyncio.Lock for concurrent access.
    """

    def __init__(self):
        """Initialize the token store."""
        self._tokens: dict[str, ServerTokenData] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Token store cleanup task started")

    async def stop(self) -> None:
        """Stop the background cleanup task."""
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("Token store cleanup task stopped")

    async def create(self, user_id: str, server_id: str, ttl_seconds: int = 300) -> str:
        """Create a new server token.

        Args:
            user_id: The user this token authorizes.
            server_id: The server this token is valid for.
            ttl_seconds: Time-to-live in seconds (default 5 minutes).

        Returns:
            The opaque token string (UUID).
        """
        token = str(uuid4())
        expires_at = datetime.now(UTC).replace(microsecond=0) + \
            __import__('datetime').timedelta(seconds=ttl_seconds)

        async with self._lock:
            self._tokens[token] = ServerTokenData(
                user_id=user_id,
                server_id=server_id,
                expires_at=expires_at,
            )

        logger.debug(f"Created server token {token[:8]}... for user {user_id[:8]}...")
        return token

    async def consume(self, token: str, server_id: str) -> ServerTokenData | None:
        """Consume a token and return its data.

        This is atomic: the token is looked up and deleted in one operation.
        If the token doesn't exist, is expired, or is for a different server,
        returns None.

        Args:
            token: The token to consume.
            server_id: The server attempting to use this token.

        Returns:
            The token data if valid, None otherwise.
        """
        async with self._lock:
            data = self._tokens.get(token)

            if data is None:
                logger.warning(f"Token not found: {token[:8]}...")
                return None

            # Check server matches
            if data.server_id != server_id:
                logger.warning(
                    f"Token {token[:8]}... used on wrong server "
                    f"(expected {data.server_id[:8]}..., got {server_id[:8]}...)"
                )
                return None

            # Check expiry
            if datetime.now(UTC) > data.expires_at:
                logger.warning(f"Token {token[:8]}... expired")
                del self._tokens[token]
                return None

            # Delete and return (one-time use)
            del self._tokens[token]
            logger.debug(f"Consumed token {token[:8]}... for user {data.user_id[:8]}...")
            return data

    async def _cleanup_loop(self) -> None:
        """Background task to clean up expired tokens."""
        while True:
            try:
                await asyncio.sleep(60)  # Cleanup every minute
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in token cleanup: {e}")

    async def _cleanup_expired(self) -> None:
        """Remove expired tokens from storage."""
        now = datetime.now(UTC)
        async with self._lock:
            before_count = len(self._tokens)
            self._tokens = {k: v for k, v in self._tokens.items() if v.expires_at > now}
            after_count = len(self._tokens)

            if before_count != after_count:
                logger.debug(
                    f"Cleaned up {before_count - after_count} expired tokens, "
                    f"{after_count} remaining"
                )

    @property
    def token_count(self) -> int:
        """Get the number of tokens currently stored."""
        return len(self._tokens)


# Module-level singleton
_token_store: TokenStore | None = None


def get_token_store() -> TokenStore:
    """Get the global TokenStore instance.

    Raises:
        RuntimeError: If TokenStore has not been initialized.
    """
    if _token_store is None:
        raise RuntimeError("TokenStore not initialized. Call init_token_store() first.")
    return _token_store


def init_token_store() -> TokenStore:
    """Initialize the global TokenStore instance.

    Returns:
        The initialized TokenStore.
    """
    global _token_store
    _token_store = TokenStore()
    return _token_store


# =============================================================================
# Legacy Compatibility (to be removed after migration)
# =============================================================================

# Keep old names as aliases during transition
TokenTracker = TokenStore
_token_tracker: TokenStore | None = None


def get_token_tracker() -> TokenStore:
    """Legacy alias for get_token_store()."""
    return get_token_store()


def init_token_tracker() -> TokenStore:
    """Legacy alias for init_token_store()."""
    global _token_tracker
    store = init_token_store()
    _token_tracker = store
    return store
