"""Hub heartbeat manager for Server self-registration and health reporting.

This module enables fault-tolerant communication between Server and Hub:
1. Server automatically registers with Hub on startup
2. Server periodically heartbeats to Hub to re-register if needed
3. If Hub restarts, Server reconnects automatically
4. If Server restarts, it re-registers with Hub

The heartbeat is a simple registration call - Hub's health poller
handles the actual health checking.
"""

import asyncio
import logging

from app import __version__
from app.config import settings
from app.domain.hub.client import HubClient

logger = logging.getLogger(__name__)


class HeartbeatManager:
    """Manages Server's registration and heartbeat with Hub."""

    def __init__(
        self,
        server_name: str,
        endpoint_url: str,
        interval_seconds: int = 30,
        initial_retry_interval: int = 5,
        max_initial_retries: int = 12,
    ):
        """Initialize the heartbeat manager.

        Args:
            server_name: Name for this server in Hub (e.g., "dev-server")
            endpoint_url: This server's API endpoint (e.g., "http://localhost:25811")
            interval_seconds: How often to heartbeat after registration (default: 30s)
            initial_retry_interval: Retry interval during initial registration (default: 5s)
            max_initial_retries: Max initial registration attempts (default: 12 = 60s)
        """
        self.server_name = server_name
        self.endpoint_url = endpoint_url
        self.interval_seconds = interval_seconds
        self.initial_retry_interval = initial_retry_interval
        self.max_initial_retries = max_initial_retries
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._registered = False
        self._initial_registration_attempts = 0

        self.hub_client: HubClient | None
        try:
            self.hub_client = HubClient()
        except ValueError as e:
            logger.error(f"Failed to initialize Hub client: {e}")
            self.hub_client = None

    async def start(self) -> None:
        """Start the heartbeat background task."""
        if self._running:
            logger.warning("Heartbeat manager already running")
            return

        if not self.hub_client:
            logger.error("Cannot start heartbeat: Hub client not initialized")
            return

        self._running = True

        # Immediately attempt registration
        await self._register()

        # Start background heartbeat loop
        self._task = asyncio.create_task(self._heartbeat_loop())
        logger.info(
            "Heartbeat manager started (interval: %ds, endpoint: %s)",
            self.interval_seconds,
            self.endpoint_url,
        )

    async def stop(self) -> None:
        """Stop the heartbeat background task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Heartbeat manager stopped")

    async def _heartbeat_loop(self) -> None:
        """Main heartbeat loop - periodically re-registers with Hub.
        
        Uses a faster retry interval during initial registration, then
        switches to normal interval once registered.
        """
        while self._running:
            try:
                # Use faster interval until first successful registration
                if not self._registered:
                    interval = self.initial_retry_interval
                    self._initial_registration_attempts += 1
                else:
                    interval = self.interval_seconds
                    
                await asyncio.sleep(interval)
                await self._register()
            except Exception as e:
                logger.error("Error in heartbeat loop: %s", e)

    async def _register(self) -> None:
        """Register (or re-register) this server with Hub."""
        if not self.hub_client:
            return

        try:
            result = await self.hub_client.register(
                name=self.server_name,
                endpoint_url=self.endpoint_url,
                registration_secret=settings.hub_registration_secret or None,
            )

            if result:
                if not self._registered:
                    # First successful registration
                    logger.info(
                        "Successfully registered with Hub: %s (version: %s)",
                        self.endpoint_url,
                        __version__,
                    )
                    self._registered = True
                else:
                    # Subsequent heartbeats
                    logger.debug("Heartbeat sent to Hub: %s", self.endpoint_url)
            else:
                # Registration failed
                if self._registered:
                    logger.warning(
                        "Lost connection to Hub, will retry in %ds",
                        self.interval_seconds,
                    )
                    self._registered = False
                else:
                    # Still trying to connect for the first time - use debug level
                    # to avoid spamming logs during normal startup timing delays
                    retry_interval = self.initial_retry_interval
                    logger.debug(
                        "Hub not reachable yet, will retry in %ds (attempt %d)",
                        retry_interval,
                        self._initial_registration_attempts,
                    )

        except Exception as e:
            # During initial registration, connection errors are expected while
            # Hub is starting up - use a less alarming log level
            if not self._registered and self._initial_registration_attempts < self.max_initial_retries:
                logger.debug(
                    "Hub registration attempt %d failed (Hub may still be starting): %s",
                    self._initial_registration_attempts,
                    type(e).__name__,
                )
            else:
                logger.exception("Unexpected error during Hub registration: %s", e)
            self._registered = False


# Global instance
_heartbeat_manager: HeartbeatManager | None = None


def create_heartbeat_manager(
    server_name: str | None = None,
    endpoint_url: str | None = None,
) -> HeartbeatManager | None:
    """Create a heartbeat manager if Hub mode is configured.

    Args:
        server_name: Name for this server. Defaults to "server-{port}".
        endpoint_url: This server's endpoint. Defaults to "http://{host}:{port}".

    Returns:
        HeartbeatManager instance, or None if not in hub mode.
    """
    global _heartbeat_manager

    if settings.auth_mode != "hub":
        return None

    if not settings.hub_url or not settings.hub_server_token:
        logger.warning(
            "auth_mode=hub but hub_url or hub_server_token not configured"
        )
        return None

    # Generate defaults from settings
    if not server_name:
        server_name = f"server-{settings.port}"

    if not endpoint_url:
        # Use localhost if host is 0.0.0.0 (bind-all)
        host = "localhost" if settings.host in ("0.0.0.0", "127.0.0.1") else settings.host
        endpoint_url = f"http://{host}:{settings.port}"

    _heartbeat_manager = HeartbeatManager(
        server_name=server_name,
        endpoint_url=endpoint_url,
    )

    return _heartbeat_manager


def get_heartbeat_manager() -> HeartbeatManager | None:
    """Get the global heartbeat manager instance."""
    return _heartbeat_manager
