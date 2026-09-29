"""Internal endpoints for server-to-hub communication.

These endpoints are called by registered servers to authorize operations
and retrieve credentials. They require server identity authentication
(server auth token from the server registry).

Security: These endpoints are internal and should be protected at the
network level in production (e.g., only accessible from server IPs).
"""

import logging
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as _rl_settings
from app.db.database import get_db
from app.db.models import (
    Connection,
    ConnectionFilesystem,
    GrantGroupConnection,
    Server,
    UserGroup,
    UserGroupGrantGroup,
)
from app.domain.audit import AuditService
from app.domain.auth.tokens import get_token_store
from app.middleware.rate_limit import _server_token
from app.middleware.rate_limit import limiter as _rl

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


# =============================================================================
# New Simplified Authorization API
# =============================================================================


class AuthorizeRequest(BaseModel):
    """Request to authorize an operation."""

    server_token: str = Field(..., description="The opaque server token")
    request_type: Literal["execute", "preview", "browse"] = Field(
        ..., description="Type of operation being requested"
    )
    workflow: dict[str, Any] | None = Field(
        None, description="Workflow JSON (required for execute/preview)"
    )
    path: str | None = Field(
        None, description="File path (for browse operations)"
    )
    connection_ids: list[str] = Field(
        default_factory=list, description="Hub connection IDs used in workflow"
    )


class AuthorizeCredentials(BaseModel):
    """Resolved connection credentials."""

    type: str  # "database" or "filesystem"
    read_only: bool = False
    # Database fields
    db_type: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    # Filesystem fields
    path: str | None = None
    path_type: str | None = None


class AuthorizeFilePath(BaseModel):
    """File path permission."""

    path: str
    read_only: bool


class AuthorizeResponse(BaseModel):
    """Response from authorization."""

    authorized: bool
    error: str | None = None
    user_id: str | None = None
    request_type: str | None = None
    credentials: dict[str, AuthorizeCredentials] = Field(default_factory=dict)
    file_paths: list[AuthorizeFilePath] = Field(default_factory=list)


@router.post("/authorize", response_model=AuthorizeResponse)
# Keyed by the presenting server's bearer token, not source IP: this endpoint
# is called server-to-server, so IP-keying let a token-holder that cycled IPs
# escape its per-identity budget and lumped distinct servers behind one NAT.
@_rl.limit(_rl_settings.rate_limit_internal_authorize, key_func=_server_token)
async def authorize(
    request: AuthorizeRequest,
    http_request: Request,
    server: ServerIdentity = Depends(get_server_identity),
    db: AsyncSession = Depends(get_db),
) -> AuthorizeResponse:
    """Authorize an operation and return credentials.

    This is the single authorization endpoint for all operations.
    The server token is looked up, consumed (one-time use), and
    permissions are checked based on the request type.

    Args:
        request: Authorization request with token and operation details.
        server: Authenticated server identity.
        db: Database session.

    Returns:
        AuthorizeResponse with credentials if authorized.
    """
    token_store = get_token_store()

    # 1. Consume token (atomic lookup + delete)
    token_data = await token_store.consume(
        token=request.server_token,
        server_id=str(server.server_id),
    )

    if not token_data:
        logger.warning(f"Invalid/expired/used token from server {server.server_name}")
        return AuthorizeResponse(
            authorized=False,
            error="Invalid, expired, or already used token",
        )

    user_id = token_data.user_id

    # 2. Validate connection access for execute/preview
    if request.request_type in ("execute", "preview") and request.connection_ids:
        # Check user has access to all requested connections
        accessible = await _get_user_accessible_connections(UUID(user_id), db)
        unauthorized = [c for c in request.connection_ids if c not in accessible]

        if unauthorized:
            logger.warning(
                f"User {user_id[:8]}... unauthorized for connections: {unauthorized}"
            )
            return AuthorizeResponse(
                authorized=False,
                error=f"Unauthorized connections: {unauthorized}",
            )

    # 3. Resolve credentials
    credentials: dict[str, AuthorizeCredentials] = {}
    if request.connection_ids:
        from app.domain.connections import (
            ConnectionStore,
            EncryptionKeyError,
            ResolvedDatabaseConnection,
            ResolvedFilesystemConnection,
        )

        try:
            store = ConnectionStore(db)
            for conn_id in request.connection_ids:
                resolved = await store.resolve_connection(conn_id)
                if resolved:
                    if isinstance(resolved, ResolvedDatabaseConnection):
                        credentials[conn_id] = AuthorizeCredentials(
                            type="database",
                            read_only=resolved.read_only,
                            db_type=resolved.db_type.value,
                            host=resolved.host,
                            port=resolved.port,
                            database=resolved.database,
                            username=resolved.username,
                            password=resolved.password,
                        )
                    elif isinstance(resolved, ResolvedFilesystemConnection):
                        credentials[conn_id] = AuthorizeCredentials(
                            type="filesystem",
                            read_only=resolved.read_only,
                            path=resolved.path,
                            path_type=resolved.path_type.value,
                        )
        except EncryptionKeyError as e:
            logger.error(f"Connection store not available: {e}")

    # 4. Get user's file path grants
    file_paths = await _get_user_file_paths_for_authorize(UUID(user_id), db)

    # 5. Log audit event
    audit_service = AuditService(db)
    await audit_service.log_event(
        event_type=f"authorize.{request.request_type}",
        actor_type="user",
        actor_identity=user_id,
        server_id=server.server_id,
        details={
            "request_type": request.request_type,
            "connection_count": len(request.connection_ids),
            "file_path_count": len(file_paths),
        },
    )
    await db.commit()

    logger.info(
        f"Authorized {request.request_type} for user {user_id[:8]}... "
        f"on server {server.server_name}, {len(credentials)} credentials"
    )

    return AuthorizeResponse(
        authorized=True,
        user_id=user_id,
        request_type=request.request_type,
        credentials=credentials,
        file_paths=file_paths,
    )


async def _get_user_accessible_connections(user_id: UUID, db: AsyncSession) -> set[str]:
    """Get connection IDs accessible to a user via grant groups."""
    result = await db.execute(
        select(GrantGroupConnection.connection_id)
        .join(
            UserGroupGrantGroup,
            UserGroupGrantGroup.grant_group_id == GrantGroupConnection.grant_group_id,
        )
        .join(UserGroup, UserGroup.group_id == UserGroupGrantGroup.user_group_id)
        .where(UserGroup.user_id == user_id)
        .distinct()
    )
    return {str(row[0]) for row in result.fetchall()}


async def _get_user_file_paths_for_authorize(
    user_id: UUID, db: AsyncSession
) -> list[AuthorizeFilePath]:
    """Get filesystem paths accessible to user via grant groups."""
    result = await db.execute(
        select(Connection, ConnectionFilesystem)
        .join(ConnectionFilesystem, Connection.id == ConnectionFilesystem.connection_id)
        .join(GrantGroupConnection, GrantGroupConnection.connection_id == Connection.id)
        .join(
            UserGroupGrantGroup,
            UserGroupGrantGroup.grant_group_id == GrantGroupConnection.grant_group_id,
        )
        .join(UserGroup, UserGroup.group_id == UserGroupGrantGroup.user_group_id)
        .where(UserGroup.user_id == user_id)
        .where(Connection.type == "filesystem")
        .distinct()
    )
    rows = result.all()

    return [
        AuthorizeFilePath(path=fs.path, read_only=conn.read_only)
        for conn, fs in rows
    ]

