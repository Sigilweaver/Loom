"""Server token storage for authorization.

Server tokens are opaque UUIDs that authorize a user to perform operations
on a specific server. This module stores token metadata and handles one-time
use enforcement by claiming tokens atomically.

Two backends are supported via :data:`Settings.token_store_backend`:

* ``"memory"`` (default): in-process dict. Fast, no external dependencies,
  but tokens are lost on restart and cannot be shared across Hub replicas.
* ``"postgres"``: tokens persisted to ``server_tokens`` table. Atomic
  ``UPDATE ... RETURNING`` ensures concurrent consumers race to claim a
  given token and only one succeeds. Required for horizontally scaled Hub.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.utils import rows_affected

logger = logging.getLogger(__name__)


@dataclass
class ServerTokenData:
    """Data associated with a server token."""

    user_id: str
    server_id: str
    expires_at: datetime


class TokenStore:
    """Abstract base for server-token storage backends.

    Subclasses implement ``create`` and ``consume`` with atomic semantics:
    a token may only be consumed once, even when multiple workers race for
    the same value.
    """

    async def start(self) -> None:  # pragma: no cover - default no-op
        return None

    async def stop(self) -> None:  # pragma: no cover - default no-op
        return None

    async def create(
        self, user_id: str, server_id: str, ttl_seconds: int = 300
    ) -> str:
        raise NotImplementedError

    async def consume(
        self, token: str, server_id: str
    ) -> ServerTokenData | None:
        raise NotImplementedError

    @property
    def token_count(self) -> int:  # pragma: no cover - diagnostic only
        return -1


class InMemoryTokenStore(TokenStore):
    """In-process token store backed by an ``asyncio.Lock``-guarded dict.

    Suitable for single-replica Hub deployments. Tokens are dropped on
    restart, which acts as a fail-closed safety net.
    """

    def __init__(self) -> None:
        self._tokens: dict[str, ServerTokenData] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("InMemoryTokenStore cleanup task started")

    async def stop(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("InMemoryTokenStore cleanup task stopped")

    async def create(
        self, user_id: str, server_id: str, ttl_seconds: int = 300
    ) -> str:
        token = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        async with self._lock:
            self._tokens[token] = ServerTokenData(
                user_id=user_id, server_id=server_id, expires_at=expires_at
            )
        logger.debug("Created server token %s... for user %s...", token[:8], user_id[:8])
        return token

    async def consume(
        self, token: str, server_id: str
    ) -> ServerTokenData | None:
        async with self._lock:
            data = self._tokens.get(token)
            if data is None:
                logger.warning("Token not found: %s...", token[:8])
                return None
            if data.server_id != server_id:
                logger.warning(
                    "Token %s... used on wrong server (expected %s..., got %s...)",
                    token[:8], data.server_id[:8], server_id[:8],
                )
                return None
            if datetime.now(UTC) > data.expires_at:
                logger.warning("Token %s... expired", token[:8])
                del self._tokens[token]
                return None
            del self._tokens[token]
            logger.debug(
                "Consumed token %s... for user %s...", token[:8], data.user_id[:8]
            )
            return data

    async def _cleanup_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(60)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in token cleanup: %s", e)

    async def _cleanup_expired(self) -> None:
        now = datetime.now(UTC)
        async with self._lock:
            before = len(self._tokens)
            self._tokens = {k: v for k, v in self._tokens.items() if v.expires_at > now}
            after = len(self._tokens)
            if before != after:
                logger.debug(
                    "Cleaned up %d expired tokens, %d remaining",
                    before - after,
                    after,
                )

    @property
    def token_count(self) -> int:
        return len(self._tokens)


class PostgresTokenStore(TokenStore):
    """Postgres-backed token store with atomic claim semantics.

    Claim is performed with a single statement::

        UPDATE server_tokens
           SET used_at = NOW()
         WHERE token = :token
           AND server_id = :server_id
           AND used_at IS NULL
           AND expires_at > NOW()
        RETURNING user_id, server_id, expires_at

    Only one concurrent consumer observes a row; all others see an empty
    result and treat the token as invalid. Used / expired rows are reaped
    by a periodic background task.
    """

    def __init__(
        self, session_factory: async_sessionmaker[AsyncSession] | None = None
    ) -> None:
        # Lazy default so unit tests with the in-memory backend never need
        # the DB engine.
        if session_factory is None:
            from app.db.database import async_session_maker
            session_factory = async_session_maker
        self._session_factory = session_factory
        self._cleanup_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("PostgresTokenStore cleanup task started")

    async def stop(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("PostgresTokenStore cleanup task stopped")

    async def create(
        self, user_id: str, server_id: str, ttl_seconds: int = 300
    ) -> str:
        from sqlalchemy import insert

        from app.db.models import ServerToken

        token = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        async with self._session_factory() as session:
            await session.execute(
                insert(ServerToken).values(
                    token=token,
                    user_id=user_id,
                    server_id=server_id,
                    expires_at=expires_at,
                )
            )
            await session.commit()
        logger.debug(
            "Created server token %s... for user %s...", token[:8], user_id[:8]
        )
        return token

    async def consume(
        self, token: str, server_id: str
    ) -> ServerTokenData | None:
        from sqlalchemy import text

        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    """
                    UPDATE server_tokens
                       SET used_at = NOW()
                     WHERE token = :token
                       AND server_id = :server_id
                       AND used_at IS NULL
                       AND expires_at > NOW()
                    RETURNING user_id, server_id, expires_at
                    """
                ),
                {"token": token, "server_id": server_id},
            )
            row = result.first()
            await session.commit()

        if row is None:
            logger.warning(
                "Token %s... not claimable (missing, expired, wrong server, or already used)",
                token[:8],
            )
            return None
        return ServerTokenData(
            user_id=row.user_id,
            server_id=row.server_id,
            expires_at=row.expires_at,
        )

    async def _cleanup_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(300)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in token cleanup: %s", e)

    async def _cleanup_expired(self) -> None:
        from sqlalchemy import text

        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "DELETE FROM server_tokens "
                    "WHERE expires_at < NOW() - INTERVAL '1 hour' "
                    "   OR used_at < NOW() - INTERVAL '1 hour'"
                )
            )
            await session.commit()
            reaped = rows_affected(result)
            if reaped:
                logger.debug("Reaped %d server_tokens rows", reaped)


# Module-level singleton
_token_store: TokenStore | None = None


def get_token_store() -> TokenStore:
    """Get the global :class:`TokenStore` instance."""
    if _token_store is None:
        raise RuntimeError("TokenStore not initialized. Call init_token_store() first.")
    return _token_store


def init_token_store(backend: str | None = None) -> TokenStore:
    """Initialize the global :class:`TokenStore` instance.

    The backend is selected by ``settings.token_store_backend`` unless an
    explicit value is passed (useful for tests).
    """
    global _token_store
    if backend is None:
        from app.config import settings as _settings  # avoid circular import at load
        backend = _settings.token_store_backend
    backend = (backend or "memory").lower()
    if backend == "postgres":
        _token_store = PostgresTokenStore()
        logger.info("Using PostgresTokenStore (persistent, multi-replica safe)")
    elif backend == "memory":
        _token_store = InMemoryTokenStore()
        logger.info("Using InMemoryTokenStore (single replica only)")
    else:
        raise ValueError(
            f"Unknown token_store_backend={backend!r}; expected 'memory' or 'postgres'"
        )
    return _token_store


# =============================================================================
# Legacy Compatibility (to be removed after migration)
# =============================================================================

TokenTracker = TokenStore
_token_tracker: TokenStore | None = None


def get_token_tracker() -> TokenStore:
    """Legacy alias for :func:`get_token_store`."""
    return get_token_store()


def init_token_tracker() -> TokenStore:
    """Legacy alias for :func:`init_token_store`."""
    global _token_tracker
    store = init_token_store()
    _token_tracker = store
    return store
