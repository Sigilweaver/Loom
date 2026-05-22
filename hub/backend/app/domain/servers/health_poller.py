"""Background task for polling server health"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import async_session_maker
from app.db.models import Server
from app.domain.servers.client import HealthResponse, ServerClient, ServerError

logger = logging.getLogger(__name__)


class HealthPoller:
    """Background task that periodically polls all servers for health status.

    Failure handling (WP-12):
    - ``_failure_counts`` tracks consecutive failures per server id.
    - ``_next_retry_at`` is the earliest wall-clock time at which a failing
      server should be re-polled. Backoff doubles per consecutive failure
      starting at 1s, capped at ``settings.server_backoff_max_seconds``.
    - A server is only flipped to ``offline`` once consecutive failures
      reach ``settings.server_offline_threshold`` (default 3); below that
      threshold the existing status (typically ``online`` or ``unknown``)
      is preserved so a single transient blip does not disable scheduling.
    - Any successful health response resets both maps for that server and
      sets status to ``online`` immediately.
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._running = False
        # Track consecutive failures per server for exponential backoff
        self._failure_counts: dict[str, int] = {}
        # Earliest wall-clock time at which a failing server is eligible
        # for another poll attempt.
        self._next_retry_at: dict[str, datetime] = {}

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
        """Poll a single server and update its status."""
        server_id = str(server.id)
        now = datetime.now(UTC)

        # Honour the per-server backoff schedule: if a retry isn't due
        # yet, skip this iteration entirely without touching status.
        next_retry = self._next_retry_at.get(server_id)
        if next_retry is not None and now < next_retry:
            logger.debug(
                "Skipping poll for %s (backoff until %s)",
                server.name,
                next_retry.isoformat(),
            )
            return

        client = ServerClient(server.endpoint_url, server.auth_token)
        result = await client.health()
        # Refresh "now" after the network round-trip so backoff math uses
        # the time the response actually came back.
        now = datetime.now(UTC)

        old_status = server.status
        server.last_poll = now

        if isinstance(result, HealthResponse):
            server.status = "online"
            server.version = result.version
            server.last_healthy = now
            # Reset failure tracking immediately on success.
            self._failure_counts.pop(server_id, None)
            self._next_retry_at.pop(server_id, None)

            if old_status != "online":
                logger.info(
                    "Server %s is now online (version: %s)",
                    server.name,
                    result.version,
                )
            return

        if isinstance(result, ServerError):
            failure_count = self._failure_counts.get(server_id, 0) + 1
            self._failure_counts[server_id] = failure_count

            # Schedule the next retry with exponential backoff:
            # 1s -> 2s -> 4s -> 8s -> ... capped at server_backoff_max_seconds.
            backoff_seconds = min(
                2 ** (failure_count - 1),
                settings.server_backoff_max_seconds,
            )
            self._next_retry_at[server_id] = now + timedelta(
                seconds=backoff_seconds
            )

            threshold = settings.server_offline_threshold
            if failure_count >= threshold:
                server.status = "offline"
                if old_status != "offline":
                    logger.warning(
                        "Server %s is now offline after %d consecutive "
                        "failures: %s",
                        server.name,
                        failure_count,
                        result.message,
                    )
            else:
                logger.info(
                    "Server %s health check failed (%d/%d) - status "
                    "unchanged, retry in %ds: %s",
                    server.name,
                    failure_count,
                    threshold,
                    backoff_seconds,
                    result.message,
                )

    async def poll_single_server(self, server_id: str) -> dict[str, Any]:
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
