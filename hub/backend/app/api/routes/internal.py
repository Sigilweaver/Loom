"""Internal endpoints for server-to-hub communication.

These endpoints are called by registered servers to validate tokens
and retrieve credentials. They require server identity authentication
(server auth token from the server registry).

Security: These endpoints are internal and should be protected at the
network level in production (e.g., only accessible from server IPs).
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.db.models import Server
from app.domain.auth.keys import get_key_manager
from app.domain.auth.tokens import get_token_tracker

router = APIRouter(prefix="/internal", tags=["internal"])
logger = logging.getLogger(__name__)


# Server Identity Authentication


@dataclass
class ServerIdentity:
    """Authenticated server identity."""

    server_id: UUID
    server_name: str


async def get_server_identity(
    authorization: str = Header(..., description="Bearer token for server authentication"),
    db: AsyncSession = Depends(get_db),
) -> ServerIdentity:
    """Authenticate server by its auth token.

    Servers authenticate using the auth_token configured when they were
    registered in Hub. This is a static token, not a JWT.

    Args:
        authorization: Authorization header with Bearer token.
        db: Database session.

    Returns:
        ServerIdentity with server details.

    Raises:
        HTTPException: 401 if authentication fails.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )

    token = authorization[7:]

    # Look up server by auth token
    result = await db.execute(select(Server).where(Server.auth_token == token))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid server token",
        )

    return ServerIdentity(server_id=server.id, server_name=server.name)


# Request/Response Models


class ValidateRequest(BaseModel):
    """Request to validate a server token and get credentials."""

    token: str = Field(..., description="The server token to validate")
    workflow_json: dict = Field(..., description="Full workflow for hash verification")
    connection_ids: list[str] = Field(
        default_factory=list, description="Connection IDs to resolve credentials for"
    )


class ConnectionCredentials(BaseModel):
    """Decrypted connection credentials."""

    type: str
    host: str
    port: int
    database: str
    username: str
    password: str


class ValidateResponse(BaseModel):
    """Response from token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
    scope: str | None = None
    connections: dict[str, ConnectionCredentials] | None = None
    constraints: dict | None = None


# Endpoints


@router.post("/validate", response_model=ValidateResponse)
async def validate_server_token(
    request: ValidateRequest,
    server: ServerIdentity = Depends(get_server_identity),
    db: AsyncSession = Depends(get_db),
) -> ValidateResponse:
    """Validate a server token and return credentials.

    This is the core security checkpoint. Servers call this endpoint
    before executing any workflow to:
    1. Verify the token is valid and not expired
    2. Verify the token hasn't been used before (one-time use)
    3. Verify the workflow hasn't been modified (hash check)
    4. Get credentials for hub-owned connections

    Returns credentials only if all checks pass.
    """
    key_manager = get_key_manager()
    token_tracker = get_token_tracker()

    try:
        # 1. Decode and verify JWT signature, audience, issuer, expiration
        claims = jwt.decode(
            request.token,
            key_manager.public_key,
            algorithms=["RS256"],
            audience=f"server-{server.server_id}",
            issuer=settings.jwt_issuer,
        )

        jti = claims["jti"]
        exp = datetime.fromtimestamp(claims["exp"], tz=UTC)

        # 2. Check one-time use
        if not await token_tracker.mark_used(jti, exp):
            logger.warning(f"Token replay attempt: {jti[:8]}... from server {server.server_name}")
            return ValidateResponse(valid=False, error="Token already used")

        # 3. Verify workflow hash (prevent workflow swap attacks)
        expected_hash = claims.get("workflow_hash")
        if expected_hash:
            actual_hash = _compute_workflow_hash(request.workflow_json)
            if expected_hash != actual_hash:
                logger.warning(
                    f"Workflow hash mismatch for token {jti[:8]}... "
                    f"expected {expected_hash[:20]}..., got {actual_hash[:20]}..."
                )
                return ValidateResponse(
                    valid=False, error="Workflow hash mismatch - workflow was modified"
                )

        # 4. Validate requested connections match allowed
        allowed = set(claims.get("allowed_connections", []))
        requested = set(request.connection_ids)
        if not requested.issubset(allowed):
            unauthorized = requested - allowed
            logger.warning(
                f"Unauthorized connection request from server {server.server_name}: {unauthorized}"
            )
            return ValidateResponse(
                valid=False, error=f"Unauthorized connections: {unauthorized}"
            )

        # 5. Resolve credentials for requested connections
        connections: dict[str, ConnectionCredentials] = {}
        if request.connection_ids:
            from app.domain.connections import ConnectionStore, EncryptionKeyError

            try:
                store = ConnectionStore(db)
                for conn_id in request.connection_ids:
                    resolved = await store.resolve_connection(conn_id)
                    if resolved:
                        resolved_type = resolved.type
                        type_str = (
                            resolved_type
                            if isinstance(resolved_type, str)
                            else resolved_type.value
                        )
                        connections[conn_id] = ConnectionCredentials(
                            type=type_str,
                            host=resolved.host,
                            port=resolved.port,
                            database=resolved.database,
                            username=resolved.username,
                            password=resolved.password,
                        )
                    else:
                        logger.warning(f"Connection {conn_id} not found in store")
            except EncryptionKeyError as e:
                logger.error(f"Connection store not available: {e}")
                # Continue without credentials if store not configured

        # 6. Log audit
        user_id = claims.get("sub", "unknown")
        scope = claims.get("scope", "unknown")
        logger.info(
            f"Token validated: user={user_id[:8]}..., server={server.server_name}, "
            f"scope={scope}, connections={len(request.connection_ids)}"
        )

        return ValidateResponse(
            valid=True,
            user_id=user_id,
            scope=scope,
            connections=connections if connections else None,
            constraints=claims.get("constraints"),
        )

    except jwt.ExpiredSignatureError:
        logger.warning(f"Expired token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Token expired")
    except jwt.InvalidAudienceError:
        logger.warning(f"Invalid audience in token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Token not valid for this server")
    except jwt.InvalidIssuerError:
        logger.warning(f"Invalid issuer in token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Invalid token issuer")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token from server {server.server_name}: {e}")
        return ValidateResponse(valid=False, error=f"Invalid token: {e}")


def _compute_workflow_hash(workflow: dict) -> str:
    """Compute a deterministic hash of the workflow.

    Must match the hashing algorithm in CapabilityIssuer.

    Args:
        workflow: The workflow JSON.

    Returns:
        Hash string in format "sha256:hexdigest".
    """
    canonical = json.dumps(workflow, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return f"sha256:{digest}"
