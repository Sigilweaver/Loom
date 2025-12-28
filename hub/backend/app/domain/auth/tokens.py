"""Token tracking for one-time use enforcement.

Server tokens are designed to be used exactly once. This module tracks
issued tokens and rejects reuse attempts. This prevents replay attacks
where an attacker captures a valid token and attempts to reuse it.

In Phase 1, tracking is in-memory. For production with multiple Hub
instances, this should be backed by Redis or a database.
"""

import asyncio
import logging
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


class TokenTracker:
    """Tracks issued tokens to enforce one-time use.

    Maintains an in-memory set of used token IDs (JTIs) with their
    expiration times. Expired entries are periodically cleaned up.

    Thread-safe via asyncio.Lock for concurrent access.
    """

    def __init__(self):
        """Initialize the token tracker."""
        # Map of JTI -> expiration time
        self._used: dict[str, datetime] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Token tracker cleanup task started")

    async def stop(self) -> None:
        """Stop the background cleanup task."""
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("Token tracker cleanup task stopped")

    async def mark_used(self, jti: str, expires_at: datetime) -> bool:
        """Mark a token as used.

        Args:
            jti: The unique token ID (JWT ID claim).
            expires_at: When the token expires (for cleanup).

        Returns:
            True if the token was successfully marked as used (first use).
            False if the token was already used (replay attempt).
        """
        async with self._lock:
            if jti in self._used:
                logger.warning(f"Token replay attempt detected: {jti[:8]}...")
                return False

            self._used[jti] = expires_at
            logger.debug(f"Token marked as used: {jti[:8]}...")
            return True

    async def is_used(self, jti: str) -> bool:
        """Check if a token has been used.

        Args:
            jti: The unique token ID.

        Returns:
            True if the token has been used, False otherwise.
        """
        async with self._lock:
            return jti in self._used

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
        """Remove expired tokens from tracking."""
        now = datetime.now(UTC)
        async with self._lock:
            before_count = len(self._used)
            self._used = {k: v for k, v in self._used.items() if v > now}
            after_count = len(self._used)

            if before_count != after_count:
                logger.debug(
                    f"Cleaned up {before_count - after_count} expired tokens, "
                    f"{after_count} remaining"
                )

    @property
    def tracked_count(self) -> int:
        """Get the number of tokens currently being tracked."""
        return len(self._used)


# Module-level singleton
_token_tracker: TokenTracker | None = None


def get_token_tracker() -> TokenTracker:
    """Get the global TokenTracker instance.

    Raises:
        RuntimeError: If TokenTracker has not been initialized.
    """
    if _token_tracker is None:
        raise RuntimeError("TokenTracker not initialized. Call init_token_tracker() first.")
    return _token_tracker


def init_token_tracker() -> TokenTracker:
    """Initialize the global TokenTracker instance.

    Returns:
        The initialized TokenTracker.
    """
    global _token_tracker
    _token_tracker = TokenTracker()
    return _token_tracker
