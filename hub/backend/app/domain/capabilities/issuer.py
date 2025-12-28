"""Capability issuance for workflow execution.

This module handles issuing server tokens that authorize workflow execution.
A server token encapsulates:
- Who is authorized (user ID)
- What server can accept it (audience)
- What connections are allowed
- What workflow (hash for integrity verification)
- When it expires

Tokens are signed with RS256 (RSA + SHA256) for asymmetric verification.
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from app.config import Settings
from app.db.models import Server
from app.domain.auth.keys import KeyManager

logger = logging.getLogger(__name__)


@dataclass
class ServerToken:
    """A server token with metadata for the client."""

    token: str
    server_endpoint: str
    expires_in: int


@dataclass
class TokenClaims:
    """Decoded token claims for validation."""

    jti: str
    iss: str
    aud: str
    sub: str
    exp: datetime
    iat: datetime
    scope: str
    workflow_hash: str
    allowed_connections: list[str]


class CapabilityIssuer:
    """Issues server tokens for workflow execution.

    Server tokens authorize a specific user to execute a specific workflow
    on a specific server. They are short-lived (default 5 minutes) and
    single-use (enforced by TokenTracker).
    """

    def __init__(self, key_manager: KeyManager, settings: Settings):
        """Initialize the capability issuer.

        Args:
            key_manager: RSA key manager for signing tokens.
            settings: Application settings.
        """
        self.key_manager = key_manager
        self.settings = settings

    async def issue_execute_token(
        self,
        user_id: str,
        server: Server,
        workflow_json: dict,
    ) -> ServerToken:
        """Issue a token for workflow execution.

        Args:
            user_id: The user requesting execution.
            server: The target server.
            workflow_json: The workflow to execute.

        Returns:
            ServerToken with the signed JWT and metadata.
        """
        return await self._issue_token(
            user_id=user_id,
            server=server,
            workflow_json=workflow_json,
            scope="execute",
        )

    async def issue_preview_token(
        self,
        user_id: str,
        server: Server,
        workflow_json: dict,
    ) -> ServerToken:
        """Issue a token for workflow preview.

        Args:
            user_id: The user requesting preview.
            server: The target server.
            workflow_json: The workflow to preview.

        Returns:
            ServerToken with the signed JWT and metadata.
        """
        return await self._issue_token(
            user_id=user_id,
            server=server,
            workflow_json=workflow_json,
            scope="preview",
        )

    async def _issue_token(
        self,
        user_id: str,
        server: Server,
        workflow_json: dict,
        scope: str,
    ) -> ServerToken:
        """Issue a server token.

        Args:
            user_id: The user requesting the capability.
            server: The target server.
            workflow_json: The workflow JSON.
            scope: The operation scope (execute, preview).

        Returns:
            ServerToken with the signed JWT and metadata.
        """
        # Extract hub-owned connection IDs
        connection_ids = self.extract_hub_connections(workflow_json)

        # Generate unique token ID
        jti = str(uuid4())

        # Build claims
        now = datetime.now(UTC)
        exp = now + timedelta(seconds=self.settings.server_token_ttl_seconds)

        claims = {
            "jti": jti,
            "iss": self.settings.jwt_issuer,
            "aud": f"server-{server.id}",
            "sub": user_id,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "scope": scope,
            "workflow_hash": self._hash_workflow(workflow_json),
            "allowed_connections": connection_ids,
        }

        # Sign token with RS256
        token = jwt.encode(
            claims,
            self.key_manager.private_key,
            algorithm="RS256",
            headers={"kid": self.key_manager.key_id},
        )

        logger.info(
            f"Issued {scope} token for user {user_id[:8]}... "
            f"on server {server.name}, {len(connection_ids)} connections"
        )

        return ServerToken(
            token=token,
            server_endpoint=server.endpoint_url,
            expires_in=self.settings.server_token_ttl_seconds,
        )

    def extract_hub_connections(self, workflow: dict) -> list[str]:
        """Extract hub-owned connection IDs from workflow.

        Scans all tools in the workflow for database inputs with owner='hub'
        and extracts their connection IDs.

        Args:
            workflow: The workflow JSON.

        Returns:
            List of connection IDs that need Hub authorization.
        """
        connections = []
        for tool in workflow.get("tools", []):
            config = tool.get("config", {})

            # Check for database inputs (Input tools with database category)
            if tool.get("tool_id") == "Input":
                if config.get("category") == "database":
                    owner = config.get("owner", "client")
                    if owner == "hub":
                        conn_id = config.get("connectionId")
                        if conn_id and conn_id not in connections:
                            connections.append(conn_id)

            # Also check connection field directly (some tools reference connections)
            if "connection" in config:
                conn = config["connection"]
                if isinstance(conn, dict):
                    owner = conn.get("owner", "client")
                    if owner == "hub":
                        conn_id = conn.get("id")
                        if conn_id and conn_id not in connections:
                            connections.append(conn_id)

        return connections

    def _hash_workflow(self, workflow: dict) -> str:
        """Compute a deterministic hash of the workflow.

        Uses SHA256 of the canonicalized JSON for deterministic hashing.

        Args:
            workflow: The workflow JSON.

        Returns:
            Hash string in format "sha256:hexdigest".
        """
        # Canonicalize by sorting keys
        canonical = json.dumps(workflow, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        return f"sha256:{digest}"

    def decode_token(self, token: str, server_id: str) -> TokenClaims:
        """Decode and verify a server token.

        This is used by Hub to validate tokens during the internal
        validation request from servers.

        Args:
            token: The JWT string.
            server_id: Expected server ID (for audience verification).

        Returns:
            Decoded token claims.

        Raises:
            jwt.InvalidTokenError: If token is invalid.
        """
        claims = jwt.decode(
            token,
            self.key_manager.public_key,
            algorithms=["RS256"],
            audience=f"server-{server_id}",
            issuer=self.settings.jwt_issuer,
        )

        return TokenClaims(
            jti=claims["jti"],
            iss=claims["iss"],
            aud=claims["aud"],
            sub=claims["sub"],
            exp=datetime.fromtimestamp(claims["exp"], tz=UTC),
            iat=datetime.fromtimestamp(claims["iat"], tz=UTC),
            scope=claims["scope"],
            workflow_hash=claims["workflow_hash"],
            allowed_connections=claims.get("allowed_connections", []),
        )


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


def init_issuer(key_manager: KeyManager, settings: Settings) -> CapabilityIssuer:
    """Initialize the global CapabilityIssuer instance.

    Args:
        key_manager: RSA key manager.
        settings: Application settings.

    Returns:
        The initialized CapabilityIssuer.
    """
    global _issuer
    _issuer = CapabilityIssuer(key_manager, settings)
    return _issuer
