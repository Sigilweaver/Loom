"""Hub client for Server-to-Hub communication.

This module provides the client used by Server to authorize operations
and retrieve credentials from Hub. It's used when auth_mode="hub".

The authorization flow:
1. Studio requests a server token from Hub
2. Studio sends token + workflow to Server
3. Server calls Hub's /internal/authorize with token + operation details
4. Hub validates token (one-time use), checks permissions, returns credentials
5. Server executes with those credentials
"""

import logging
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import settings
from app.domain.connections.models import ResolvedConnection

logger = logging.getLogger(__name__)


@dataclass
class FilePathGrant:
    """A file path grant from Hub authorization."""

    path: str
    read_only: bool


@dataclass
class AuthorizationResult:
    """Result of Hub authorization."""

    authorized: bool
    error: str | None = None
    user_id: str | None = None
    request_type: str | None = None
    connections: dict[str, ResolvedConnection] | None = None
    file_paths: list[FilePathGrant] | None = None


class HubClient:
    """Client for Server to communicate with Hub.

    Used in hub auth mode to validate server tokens and retrieve
    credentials for hub-owned connections.
    """

    def __init__(self, hub_url: str | None = None, server_token: str | None = None):
        """Initialize the Hub client.

        Args:
            hub_url: Hub server URL. Defaults to settings.hub_url.
            server_token: This server's auth token. Defaults to settings.hub_server_token.
        """
        self.hub_url = (hub_url or settings.hub_url).rstrip("/")
        self.server_token = server_token or settings.hub_server_token

        if not self.hub_url:
            raise ValueError("hub_url is required for HubClient")
        if not self.server_token:
            raise ValueError("hub_server_token is required for HubClient")

    # =========================================================================
    # Server Registration
    # =========================================================================

    async def register(
        self,
        name: str,
        endpoint_url: str,
        registration_secret: str | None = None,
        timeout: float = 10.0,
    ) -> dict[str, Any] | None:
        """Register this server with Hub.

        Args:
            name: Server name (e.g., "dev-server", "prod-server-1")
            endpoint_url: This server's API endpoint (e.g., "http://localhost:25811")
            registration_secret: Shared secret for Hub registration (if required)
            timeout: Request timeout in seconds.

        Returns:
            Registration response dict if successful, None if failed.
        """
        try:
            # Build headers
            headers = {}
            if registration_secret:
                headers["X-Registration-Secret"] = registration_secret

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.hub_url}/api/v1/servers",
                    json={
                        "name": name,
                        "endpoint_url": endpoint_url,
                        "auth_token": self.server_token,
                    },
                    headers=headers,
                )

                if response.status_code not in (200, 201):
                    logger.error(
                        f"Hub registration failed with status "
                        f"{response.status_code}: {response.text}"
                    )
                    return None

                data: dict[str, Any] = response.json()
                logger.info(f"Successfully registered with Hub: {endpoint_url}")
                return data

        except httpx.TimeoutException:
            logger.warning(f"Hub registration timed out after {timeout}s")
            return None
        except httpx.ConnectError as e:
            logger.warning(f"Cannot reach Hub for registration: {e}")
            return None
        except httpx.RemoteProtocolError as e:
            # Server disconnected mid-request - common during Hub startup
            logger.debug(f"Hub not ready yet (protocol error): {e}")
            return None
        except Exception as e:
            logger.exception(f"Unexpected error during Hub registration: {e}")
            return None

    # =========================================================================
    # Authorization
    # =========================================================================

    async def authorize(
        self,
        server_token: str,
        request_type: Literal["execute", "preview", "browse"],
        connection_ids: list[str] | None = None,
        workflow: dict[str, Any] | None = None,
        path: str | None = None,
        timeout: float = 10.0,
    ) -> AuthorizationResult:
        """Authorize an operation with Hub.

        This is the single authorization method for all operations.
        The server token is validated, consumed (one-time use), and
        credentials are returned for the requested connections.

        Args:
            server_token: The opaque server token from Studio.
            request_type: Type of operation being requested.
            connection_ids: Hub connection IDs to resolve credentials for.
            workflow: Workflow JSON (for execute/preview, optional for context).
            path: File path (for browse operations).
            timeout: Request timeout in seconds.

        Returns:
            AuthorizationResult with credentials if authorized.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.hub_url}/api/v1/internal/authorize",
                    headers={"Authorization": f"Bearer {self.server_token}"},
                    json={
                        "server_token": server_token,
                        "request_type": request_type,
                        "workflow": workflow,
                        "path": path,
                        "connection_ids": connection_ids or [],
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Hub authorization failed with status {response.status_code}")
                    return AuthorizationResult(
                        authorized=False,
                        error=f"Hub error: {response.status_code} - {response.text}",
                    )

                data = response.json()

                if not data.get("authorized"):
                    return AuthorizationResult(
                        authorized=False,
                        error=data.get("error", "Unknown authorization error"),
                    )

                # Convert credentials to ResolvedConnection objects
                connections: dict[str, ResolvedConnection] = {}
                credentials_data = data.get("credentials") or {}
                for conn_id, creds in credentials_data.items():
                    conn_type = creds.get("type")
                    if conn_type == "database":
                        connections[conn_id] = ResolvedConnection(
                            id=conn_id,
                            name=creds.get("name", conn_id),
                            type=creds.get("db_type", conn_type),
                            host=creds["host"],
                            port=creds["port"],
                            database=creds["database"],
                            username=creds["username"],
                            password=creds["password"],
                        )
                    # Filesystem connections are handled via file_paths

                # Convert file paths
                file_paths: list[FilePathGrant] = []
                for fp in data.get("file_paths") or []:
                    file_paths.append(
                        FilePathGrant(
                            path=fp["path"],
                            read_only=fp.get("read_only", True),
                        )
                    )

                return AuthorizationResult(
                    authorized=True,
                    user_id=data.get("user_id"),
                    request_type=data.get("request_type"),
                    connections=connections if connections else None,
                    file_paths=file_paths if file_paths else None,
                )

        except httpx.TimeoutException:
            logger.error(f"Hub authorization timed out after {timeout}s")
            return AuthorizationResult(authorized=False, error="Hub authorization timed out")
        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to Hub: {e}")
            return AuthorizationResult(authorized=False, error=f"Cannot reach Hub: {e}")
        except KeyError as e:
            logger.error(f"Hub authorization response is missing field {e}")
            return AuthorizationResult(
                authorized=False,
                error=f"Hub returned an incomplete authorization response (missing {e})",
            )
        except Exception as e:
            logger.exception(f"Unexpected error during Hub authorization: {e}")
            return AuthorizationResult(authorized=False, error=f"Hub authorization error: {e}")


# Factory function


def get_hub_client() -> HubClient | None:
    """Get a HubClient if hub mode is configured.

    Returns:
        HubClient instance, or None if not in hub mode.
    """
    if settings.auth_mode != "hub":
        return None

    if not settings.hub_url or not settings.hub_server_token:
        logger.warning("auth_mode=hub but hub_url or hub_server_token not configured")
        return None

    return HubClient()
