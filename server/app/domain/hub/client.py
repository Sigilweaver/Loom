"""Hub client for Server-to-Hub communication.

This module provides the client used by Server to validate tokens
and retrieve credentials from Hub. It's used when auth_mode="hub".

The flow:
1. Studio sends workflow + server token to Server
2. Server calls Hub's /internal/validate with token + workflow + connection IDs
3. Hub validates and returns credentials
4. Server executes with those credentials
"""

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings
from app.domain.connections.models import ResolvedConnection

logger = logging.getLogger(__name__)


@dataclass
class FilePathGrant:
    """A file path grant from Hub validation."""

    path: str
    read_only: bool


@dataclass
class ValidationResult:
    """Result of Hub token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
    scope: str | None = None
    connections: dict[str, ResolvedConnection] | None = None
    constraints: dict[str, Any] | None = None
    file_paths: list[FilePathGrant] | None = None  # Filesystem paths from connections


@dataclass
class BrowseValidationResult:
    """Result of Hub browse token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
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

    async def validate(
        self,
        token: str,
        workflow_json: dict,
        connection_ids: list[str],
        timeout: float = 10.0,
    ) -> ValidationResult:
        """Validate a server token and get credentials from Hub.

        Args:
            token: The server token to validate.
            workflow_json: Full workflow for hash verification.
            connection_ids: Hub connection IDs to resolve credentials for.
            timeout: Request timeout in seconds.

        Returns:
            ValidationResult with credentials if valid.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.hub_url}/api/v1/internal/validate",
                    headers={"Authorization": f"Bearer {self.server_token}"},
                    json={
                        "token": token,
                        "workflow_json": workflow_json,
                        "connection_ids": connection_ids,
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Hub validation failed with status {response.status_code}")
                    return ValidationResult(
                        valid=False,
                        error=f"Hub error: {response.status_code} - {response.text}",
                    )

                data = response.json()

                if not data.get("valid"):
                    return ValidationResult(
                        valid=False,
                        error=data.get("error", "Unknown validation error"),
                    )

                # Convert connection credentials to ResolvedConnection objects
                connections: dict[str, ResolvedConnection] = {}

                # Handle both None and missing connections field
                connections_data = data.get("connections") or {}
                for conn_id, creds in connections_data.items():
                    conn_type = creds.get("type")

                    if conn_type == "database":
                        # Database connection - convert to ResolvedConnection
                        connections[conn_id] = ResolvedConnection(
                            id=conn_id,
                            name=creds.get("name", conn_id),  # Use ID as name fallback
                            type=creds.get("db_type", creds["type"]),
                            host=creds["host"],
                            port=creds["port"],
                            database=creds["database"],
                            username=creds["username"],
                            password=creds["password"],
                        )
                    # Note: filesystem connections in the connections dict are ignored here
                    # because file_paths are now returned separately by Hub

                # Extract file paths from the dedicated file_paths field
                # This is the authoritative source for file access validation
                file_paths: list[FilePathGrant] = []
                file_paths_data = data.get("file_paths") or []
                for fp in file_paths_data:
                    file_paths.append(FilePathGrant(
                        path=fp["path"],
                        read_only=fp.get("read_only", True),
                    ))

                return ValidationResult(
                    valid=True,
                    user_id=data.get("user_id"),
                    scope=data.get("scope"),
                    connections=connections if connections else None,
                    constraints=data.get("constraints"),
                    file_paths=file_paths if file_paths else None,
                )

        except httpx.TimeoutException:
            logger.error(f"Hub validation timed out after {timeout}s")
            return ValidationResult(valid=False, error="Hub validation timed out")
        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to Hub: {e}")
            return ValidationResult(valid=False, error=f"Cannot reach Hub: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error during Hub validation: {e}")
            return ValidationResult(valid=False, error=f"Hub validation error: {e}")

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
                        f"Hub registration failed with status {response.status_code}: {response.text}"
                    )
                    return None

                data = response.json()
                logger.info(f"Successfully registered with Hub: {endpoint_url}")
                return data

        except httpx.TimeoutException:
            logger.warning(f"Hub registration timed out after {timeout}s")
            return None
        except httpx.ConnectError as e:
            logger.warning(f"Cannot reach Hub for registration: {e}")
            return None
        except Exception as e:
            logger.exception(f"Unexpected error during Hub registration: {e}")
            return None

    async def validate_browse(
        self,
        token: str,
        timeout: float = 10.0,
    ) -> BrowseValidationResult:
        """Validate a browse token and get file path grants from Hub.

        Args:
            token: The browse token to validate.
            timeout: Request timeout in seconds.

        Returns:
            BrowseValidationResult with file path grants if valid.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.hub_url}/api/v1/internal/validate-browse",
                    headers={"Authorization": f"Bearer {self.server_token}"},
                    json={"token": token},
                )

                if response.status_code != 200:
                    logger.error(f"Hub browse validation failed with status {response.status_code}")
                    return BrowseValidationResult(
                        valid=False,
                        error=f"Hub error: {response.status_code} - {response.text}",
                    )

                data = response.json()

                if not data.get("valid"):
                    return BrowseValidationResult(
                        valid=False,
                        error=data.get("error", "Unknown validation error"),
                    )

                # Convert file paths to FilePathGrant objects
                file_paths: list[FilePathGrant] = []
                for fp in data.get("file_paths") or []:
                    file_paths.append(FilePathGrant(
                        path=fp["path"],
                        read_only=fp.get("read_only", True),
                    ))

                return BrowseValidationResult(
                    valid=True,
                    user_id=data.get("user_id"),
                    file_paths=file_paths,
                )

        except httpx.TimeoutException:
            logger.error(f"Hub browse validation timed out after {timeout}s")
            return BrowseValidationResult(valid=False, error="Hub validation timed out")
        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to Hub: {e}")
            return BrowseValidationResult(valid=False, error=f"Cannot reach Hub: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error during Hub browse validation: {e}")
            return BrowseValidationResult(valid=False, error=f"Hub validation error: {e}")


# Factory function


def get_hub_client() -> HubClient | None:
    """Get a HubClient if hub mode is configured.

    Returns:
        HubClient instance, or None if not in hub mode.
    """
    if settings.auth_mode != "hub":
        return None

    if not settings.hub_url or not settings.hub_server_token:
        logger.warning(
            "auth_mode=hub but hub_url or hub_server_token not configured"
        )
        return None

    return HubClient()
