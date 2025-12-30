"""Background task for polling connection health.

Periodically tests all connections and updates their health status.
"""

import asyncio
import logging
from datetime import UTC, datetime
from urllib.parse import quote_plus

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_maker
from app.db.models import Connection
from app.domain.connections import ConnectionStore, EncryptionKeyError

logger = logging.getLogger(__name__)

# Default check interval: 1 hour
CONNECTION_CHECK_INTERVAL_SECONDS = 3600


class ConnectionHealthPoller:
    """Background task that periodically tests all connections for health status."""

    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Start the connection health polling background task."""
        if self._running:
            logger.warning("Connection health poller already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(
            "Connection health poller started (interval: %ds)",
            CONNECTION_CHECK_INTERVAL_SECONDS,
        )

    async def stop(self) -> None:
        """Stop the connection health polling background task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Connection health poller stopped")

    async def _poll_loop(self) -> None:
        """Main polling loop."""
        # Run initial check after short delay
        await asyncio.sleep(30)

        while self._running:
            try:
                await self._check_all_connections()
            except Exception as e:
                logger.error("Error in connection health poll loop: %s", e)

            await asyncio.sleep(CONNECTION_CHECK_INTERVAL_SECONDS)

    async def _check_all_connections(self) -> None:
        """Check all connections."""
        async with async_session_maker() as session:
            result = await session.execute(select(Connection))
            connections = result.scalars().all()

            if not connections:
                return

            # Check connections sequentially to avoid overwhelming databases
            for connection in connections:
                await self._check_connection(session, connection)

            # Commit all updates
            await session.commit()

    async def _check_connection(
        self, session: AsyncSession, connection: Connection
    ) -> None:
        """Check a single connection and update its status."""
        now = datetime.now(UTC)
        connection.last_checked = now

        try:
            store = ConnectionStore(session)
            resolved = await store.resolve_connection(connection.id)

            if resolved is None:
                connection.status = "error"
                connection.last_error = "Could not resolve connection credentials"
                return

            success, message = await self._test_connection(
                db_type=resolved.type,
                host=resolved.host,
                port=resolved.port,
                database=resolved.database,
                username=resolved.username,
                password=resolved.password,
            )

            if success:
                connection.status = "healthy"
                connection.last_healthy = now
                connection.last_error = None
                logger.debug("Connection %s is healthy", connection.name)
            else:
                connection.status = "unhealthy"
                connection.last_error = message
                logger.warning("Connection %s is unhealthy: %s", connection.name, message)

        except EncryptionKeyError as e:
            connection.status = "error"
            connection.last_error = str(e)
            logger.error("Encryption error checking connection %s: %s", connection.name, e)
        except Exception as e:
            connection.status = "error"
            connection.last_error = str(e)
            logger.error("Error checking connection %s: %s", connection.name, e)

    async def _test_connection(
        self,
        db_type: str,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
    ) -> tuple[bool, str]:
        """Test connection with provided parameters.

        Returns:
            Tuple of (success, message).
        """
        try:
            import polars as pl

            # URL-encode credentials
            safe_username = quote_plus(username)
            safe_password = quote_plus(password)

            # Build connection URL based on type
            if db_type == "postgresql":
                url = f"postgresql://{safe_username}:{safe_password}@{host}:{port}/{database}"
            elif db_type == "mysql":
                url = f"mysql://{safe_username}:{safe_password}@{host}:{port}/{database}"
            elif db_type == "mssql":
                url = f"mssql://{safe_username}:{safe_password}@{host}:{port}/{database}"
            elif db_type == "sqlite":
                url = f"sqlite://{database}"
            else:
                return False, f"Connection testing not implemented for type: {db_type}"

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: pl.read_database_uri(
                    query="SELECT 1",
                    uri=url,
                    engine="connectorx",
                ),
            )

            return True, "Connection successful"

        except ImportError as e:
            return False, f"Database driver not available: {e}"
        except Exception as e:
            # Sanitize error to not leak credentials
            error_msg = str(e)
            if password and password in error_msg:
                error_msg = error_msg.replace(password, "***")
            if username and username in error_msg:
                error_msg = error_msg.replace(username, "***")
            return False, f"Connection failed: {error_msg}"

    async def check_single_connection(self, connection_id: str) -> dict:
        """Check a single connection immediately (for manual refresh).

        Args:
            connection_id: UUID of the connection to check

        Returns:
            dict with status, last_checked, last_healthy, last_error info
        """
        from uuid import UUID

        async with async_session_maker() as session:
            result = await session.execute(
                select(Connection).where(Connection.id == UUID(connection_id))
            )
            connection = result.scalar_one_or_none()

            if not connection:
                raise ValueError(f"Connection {connection_id} not found")

            await self._check_connection(session, connection)
            await session.commit()

            return {
                "status": connection.status,
                "last_checked": (
                    connection.last_checked.isoformat() if connection.last_checked else None
                ),
                "last_healthy": (
                    connection.last_healthy.isoformat() if connection.last_healthy else None
                ),
                "last_error": connection.last_error,
            }

    async def check_all_now(self) -> dict:
        """Check all connections immediately.

        Returns:
            dict with count of checked, healthy, unhealthy connections
        """
        async with async_session_maker() as session:
            result = await session.execute(select(Connection))
            connections = result.scalars().all()

            if not connections:
                return {"checked": 0, "healthy": 0, "unhealthy": 0, "error": 0}

            for connection in connections:
                await self._check_connection(session, connection)

            await session.commit()

            healthy = sum(1 for c in connections if c.status == "healthy")
            unhealthy = sum(1 for c in connections if c.status == "unhealthy")
            error = sum(1 for c in connections if c.status == "error")

            return {
                "checked": len(connections),
                "healthy": healthy,
                "unhealthy": unhealthy,
                "error": error,
            }


# Global instance
connection_health_poller = ConnectionHealthPoller()
