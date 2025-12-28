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
class ValidationResult:
    """Result of Hub token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
    scope: str | None = None
    connections: dict[str, ResolvedConnection] | None = None
    constraints: dict[str, Any] | None = None


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
                    f"{self.hub_url}/api/internal/validate",
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
                for conn_id, creds in data.get("connections", {}).items():
                    connections[conn_id] = ResolvedConnection(
                        id=conn_id,
                        name=creds.get("name", conn_id),  # Use ID as name fallback
                        type=creds["type"],
                        host=creds["host"],
                        port=creds["port"],
                        database=creds["database"],
                        username=creds["username"],
                        password=creds["password"],
                    )

                return ValidationResult(
                    valid=True,
                    user_id=data.get("user_id"),
                    scope=data.get("scope"),
                    connections=connections,
                    constraints=data.get("constraints"),
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
