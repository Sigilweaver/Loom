"""Background task for polling server health"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import async_session_maker
from app.db.models import Server
from app.domain.servers.client import HealthResponse, ServerClient, ServerError

logger = logging.getLogger(__name__)


class HealthPoller:
    """Background task that periodically polls all servers for health status"""

    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False
        # Track consecutive failures per server for exponential backoff
        self._failure_counts: dict[str, int] = {}

    async def start(self) -> None:
        """Start the health polling background task"""
        if self._running:
            logger.warning("Health poller already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(
            "Health poller started (interval: %ds)", settings.server_poll_interval_seconds
        )

    async def stop(self) -> None:
        """Stop the health polling background task"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Health poller stopped")

    async def _poll_loop(self) -> None:
        """Main polling loop"""
        while self._running:
            try:
                await self._poll_all_servers()
            except Exception as e:
                logger.error("Error in health poll loop: %s", e)

            await asyncio.sleep(settings.server_poll_interval_seconds)

    async def _poll_all_servers(self) -> None:
        """Poll all registered servers"""
        async with async_session_maker() as session:
            result = await session.execute(select(Server))
            servers = result.scalars().all()

            if not servers:
                return

            # Poll servers concurrently
            tasks = [self._poll_server(session, server) for server in servers]
            await asyncio.gather(*tasks)

            # Commit all updates
            await session.commit()

    async def _poll_server(self, session: AsyncSession, server: Server) -> None:
        """Poll a single server and update its status"""
        server_id = str(server.id)

        # Check for exponential backoff
        failure_count = self._failure_counts.get(server_id, 0)
        if failure_count > 0:
            # Skip this poll if in backoff period
            # Backoff: 2^failures * base_interval, max 5 minutes
            backoff_multiplier = min(2**failure_count, 10)  # Max 10x interval
            if failure_count > 0 and (failure_count % backoff_multiplier) != 0:
                logger.debug(
                    "Skipping poll for %s (backoff: failure %d)", server.name, failure_count
                )
                return

        client = ServerClient(server.endpoint_url, server.auth_token)
        result = await client.health()
        now = datetime.utcnow()

        old_status = server.status
        server.last_poll = now

        if isinstance(result, HealthResponse):
            server.status = "online"
            server.version = result.version
            server.last_healthy = now
            self._failure_counts[server_id] = 0  # Reset failure count

            if old_status != "online":
                logger.info("Server %s is now online (version: %s)", server.name, result.version)

        elif isinstance(result, ServerError):
            server.status = "offline"
            self._failure_counts[server_id] = failure_count + 1

            if old_status != "offline":
                logger.warning("Server %s is now offline: %s", server.name, result.message)

    async def poll_single_server(self, server_id: str) -> dict:
        """Poll a single server immediately (for manual refresh).

        Args:
            server_id: UUID of the server to poll

        Returns:
            dict with status, version, last_poll info
        """
        from uuid import UUID

        async with async_session_maker() as session:
            result = await session.execute(
                select(Server).where(Server.id == UUID(server_id))
            )
            server = result.scalar_one_or_none()

            if not server:
                raise ValueError(f"Server {server_id} not found")

            await self._poll_server(session, server)
            await session.commit()

            return {
                "status": server.status,
                "version": server.version,
                "last_poll": server.last_poll.isoformat() if server.last_poll else None,
                "last_healthy": server.last_healthy.isoformat() if server.last_healthy else None,
            }


# Global instance
health_poller = HealthPoller()
