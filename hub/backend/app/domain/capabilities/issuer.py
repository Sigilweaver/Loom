"""Capability issuance for server operations.

This module handles issuing server tokens that authorize operations on servers.
Server tokens are opaque UUIDs - all the metadata is stored in TokenStore.

The simplified flow:
1. User requests a token from Hub
2. Hub creates an opaque token, stores user_id + server_id in TokenStore
3. User sends token to Server with their request
4. Server asks Hub to authorize (Hub looks up token, checks permissions, returns credentials)
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.config import Settings
from app.db.models import Server
from app.domain.auth.tokens import TokenStore

logger = logging.getLogger(__name__)


@dataclass
class ServerToken:
    """A server token with metadata for the client."""

    token: str
    server_endpoint: str
    expires_in: int


class CapabilityIssuer:
    """Issues server tokens for operations.

    Server tokens are opaque UUIDs. They authorize a user to make requests
    to a specific server. The actual authorization (what operations are
    allowed) happens when the server calls /internal/authorize.
    """

    def __init__(self, token_store: TokenStore, settings: Settings):
        """Initialize the capability issuer.

        Args:
            token_store: Token storage for creating tokens.
            settings: Application settings.
        """
        self.token_store = token_store
        self.settings = settings

    async def issue_token(
        self,
        user_id: str,
        server: Server,
    ) -> ServerToken:
        """Issue a server token.

        This is the single method for issuing tokens. The token doesn't
        encode what operation is allowed - that's checked at authorize time.

        Args:
            user_id: The user requesting the token.
            server: The target server.

        Returns:
            ServerToken with the opaque token and server endpoint.
        """
        token = await self.token_store.create(
            user_id=user_id,
            server_id=str(server.id),
            ttl_seconds=self.settings.server_token_ttl_seconds,
        )

        logger.info(
            f"Issued server token for user {user_id[:8]}... "
            f"on server {server.name}"
        )

        return ServerToken(
            token=token,
            server_endpoint=server.endpoint_url,
            expires_in=self.settings.server_token_ttl_seconds,
        )

    @staticmethod
    def extract_hub_connections(workflow: dict[str, Any]) -> list[str]:
        """Extract hub-owned connection IDs from workflow.

        Scans all tools in the workflow for inputs with owner='hub'
        and extracts their connection IDs.

        Args:
            workflow: The workflow JSON.

        Returns:
            List of connection IDs that need Hub authorization.
        """
        connections: list[str] = []
        for tool in workflow.get("tools", []):
            config = tool.get("config", {}) or {}

            # Check for Input tools with hub ownership
            if tool.get("type") == "Input":
                owner = config.get("owner", "client")
                if owner == "hub":
                    conn_id = config.get("connectionId")
                    if conn_id and conn_id not in connections:
                        connections.append(conn_id)

            # Also check connection field directly
            if "connection" in config:
                conn = config["connection"]
                if isinstance(conn, dict):
                    owner = conn.get("owner", "client")
                    if owner == "hub":
                        conn_id = conn.get("id")
                        if conn_id and conn_id not in connections:
                            connections.append(conn_id)

        return connections


# Module-level singleton
_issuer: CapabilityIssuer | None = None


def get_issuer() -> CapabilityIssuer:
    """Get the global CapabilityIssuer instance.

    Raises:
        RuntimeError: If issuer has not been initialized.
    """
    if _issuer is None:
        raise RuntimeError("CapabilityIssuer not initialized. Call init_issuer() first.")
    return _issuer


def init_issuer(token_store: TokenStore, settings: Settings) -> CapabilityIssuer:
    """Initialize the global CapabilityIssuer instance.

    Args:
        token_store: Token storage instance.
        settings: Application settings.

    Returns:
        The initialized CapabilityIssuer.
    """
    global _issuer
    _issuer = CapabilityIssuer(token_store, settings)
    return _issuer
