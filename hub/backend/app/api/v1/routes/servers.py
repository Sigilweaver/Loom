"""Server registry routes"""

import logging
import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, RequireAdmin, RequireAuditor
from app.config import settings
from app.db.database import get_db
from app.db.models import Group, Server, ServerGroup, UserGroup
from app.domain.auth.roles import Role, get_role_level
from app.domain.auth.sessions import SessionInfo
from app.domain.servers.client import HealthResponse, ServerClient, ServerError

router = APIRouter(prefix="/servers")
logger = logging.getLogger(__name__)


class ServerCreate(BaseModel):
    """Request to register a new server"""

    name: str
    endpoint_url: str
    auth_token: str | None = None


class ServerUpdate(BaseModel):
    """Request to update server config"""

    name: str | None = None
    endpoint_url: str | None = None
    auth_token: str | None = None


class ServerResponse(BaseModel):
    """Server details"""

    id: UUID
    name: str
    endpoint_url: str
    status: str
    version: str | None
    last_poll: str | None
    last_healthy: str | None
    created_at: str

    model_config = {"from_attributes": True}


class ServerListResponse(BaseModel):
    """List of servers"""

    servers: list[ServerResponse]
    total: int


class ConnectionInfo(BaseModel):
    """Connection info from a server (read-only view)"""

    name: str
    type: str


class ServerConnectionsResponse(BaseModel):
    """Connections available on a server"""

    server_id: UUID
    connections: list[ConnectionInfo]


class ServerTestResponse(BaseModel):
    """Response from testing server connection"""

    success: bool
    status: str
    version: str | None
    message: str | None


class ServerGroupResponse(BaseModel):
    """Group assigned to a server."""

    group_id: UUID
    group_name: str
    assigned_at: str
    assigned_by: str


class ServerGroupsResponse(BaseModel):
    """Groups assigned to a server."""

    server_id: UUID
    server_name: str
    groups: list[ServerGroupResponse]
    total: int


def _server_to_response(server: Server) -> ServerResponse:
    """Convert database model to response"""
    return ServerResponse(
        id=server.id,
        name=server.name,
        endpoint_url=server.endpoint_url,
        status=server.status,
        version=server.version,
        last_poll=server.last_poll.isoformat() if server.last_poll else None,
        last_healthy=server.last_healthy.isoformat() if server.last_healthy else None,
        created_at=server.created_at.isoformat(),
    )


# =============================================================================
# Server Listing (role-filtered)
# =============================================================================


@router.get("", response_model=ServerListResponse)
async def list_servers(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ServerListResponse:
    """List servers.

    For regular users: Returns servers available via group membership.
    For Auditor+: Returns all registered servers.
    """
    auditor_level = get_role_level(Role.AUDITOR)
    user_level = get_role_level(current_user.role)

    if user_level > auditor_level:
        # Regular users: filter by group membership
        # User -> UserGroup -> Group -> ServerGroup -> Server
        result = await db.execute(
            select(Server)
            .join(ServerGroup, Server.id == ServerGroup.server_id)
            .join(Group, ServerGroup.group_id == Group.id)
            .join(UserGroup, Group.id == UserGroup.group_id)
            .where(UserGroup.user_id == current_user.user_id)
            .order_by(Server.name)
            .distinct()
        )
    else:
        # Auditor+: see all servers
        result = await db.execute(select(Server).order_by(Server.name))

    servers = result.scalars().all()

    return ServerListResponse(
        servers=[_server_to_response(s) for s in servers],
        total=len(servers),
    )


# =============================================================================
# Server CRUD (by ID)
# =============================================================================


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def register_server(
    request: ServerCreate,
    db: AsyncSession = Depends(get_db),
    x_registration_secret: Annotated[str | None, Header()] = None,
) -> ServerResponse:
    """Register a new server or update existing one (idempotent).

    If a server with the same auth_token already exists, updates it.
    This allows servers to re-register after restarts, even if their
    endpoint URL changes (e.g., different port).

    Requires X-Registration-Secret header if server_registration_secret is configured.
    """
    # Validate registration secret if configured
    if settings.server_registration_secret:
        if not x_registration_secret:
            logger.warning("Server registration attempt without secret")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="X-Registration-Secret header required",
            )
        if not secrets.compare_digest(
            x_registration_secret, settings.server_registration_secret
        ):
            logger.warning("Server registration attempt with invalid secret")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid registration secret",
            )

    # Normalize endpoint URL
    endpoint_url = request.endpoint_url.rstrip("/")

    # Check for existing server with same auth_token (identity is by token, not endpoint)
    existing = await db.execute(select(Server).where(Server.auth_token == request.auth_token))
    server = existing.scalar_one_or_none()

    if server:
        # Update existing server (endpoint may have changed)
        server.name = request.name
        server.endpoint_url = endpoint_url
        server.status = "unknown"  # Will be updated by health check below
        logger.info("Re-registered existing server: %s (%s)", server.name, server.endpoint_url)
    else:
        # Create new server record
        server = Server(
            name=request.name,
            endpoint_url=endpoint_url,
            auth_token=request.auth_token,
            status="unknown",
            created_by="system",  # TODO: Use actual user from auth
        )
        db.add(server)
        logger.info("Registered new server: %s (%s)", server.name, server.endpoint_url)

    # Immediately poll the server to get initial status
    client = ServerClient(server.endpoint_url, server.auth_token)
    result = await client.health()
    now = datetime.now(UTC)

    server.last_poll = now
    if isinstance(result, HealthResponse):
        server.status = "online"
        server.version = result.version
        server.last_healthy = now
    else:
        server.status = "offline"

    await db.commit()
    await db.refresh(server)

    return _server_to_response(server)


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ServerResponse:
    """Get server details. Requires auditor role or higher."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    return _server_to_response(server)


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: UUID,
    request: ServerUpdate,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ServerResponse:
    """Update server configuration. Requires admin role."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    if request.name is not None:
        server.name = request.name
    if request.endpoint_url is not None:
        server.endpoint_url = request.endpoint_url.rstrip("/")
    if request.auth_token is not None:
        server.auth_token = request.auth_token

    await db.commit()
    await db.refresh(server)

    logger.info("Updated server: %s", server.name)

    return _server_to_response(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_server(
    server_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a server from the registry. Requires admin role."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    server_name = server.name
    await db.delete(server)
    await db.commit()

    logger.info("Unregistered server: %s", server_name)


@router.post("/{server_id}/refresh", response_model=ServerResponse)
async def refresh_server_status(
    server_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ServerResponse:
    """Manually refresh server status by polling it now. Requires admin role."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    # Poll the server
    client = ServerClient(server.endpoint_url, server.auth_token)
    health_result = await client.health()
    now = datetime.now(UTC)

    server.last_poll = now
    if isinstance(health_result, HealthResponse):
        server.status = "online"
        server.version = health_result.version
        server.last_healthy = now
    else:
        server.status = "offline"

    await db.commit()
    await db.refresh(server)

    return _server_to_response(server)


@router.post("/test", response_model=ServerTestResponse)
async def test_server_connection(
    request: ServerCreate,
    _admin: SessionInfo = RequireAdmin,
) -> ServerTestResponse:
    """Test connection to a server before registering it. Requires admin role."""
    client = ServerClient(request.endpoint_url.rstrip("/"), request.auth_token)
    result = await client.health()

    if isinstance(result, HealthResponse):
        return ServerTestResponse(
            success=True,
            status="online",
            version=result.version,
            message=None,
        )
    elif isinstance(result, ServerError):
        return ServerTestResponse(
            success=False,
            status="offline",
            version=None,
            message=result.message,
        )
    else:
        return ServerTestResponse(
            success=False,
            status="error",
            version=None,
            message="Unknown error",
        )


@router.get("/{server_id}/connections", response_model=ServerConnectionsResponse)
async def get_server_connections(
    server_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ServerConnectionsResponse:
    """Get connections available on a server. Requires auditor role or higher."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    client = ServerClient(server.endpoint_url, server.auth_token)
    connections_result = await client.get_connections()

    if isinstance(connections_result, ServerError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to get connections from server: {connections_result.message}",
        )

    return ServerConnectionsResponse(
        server_id=server_id,
        connections=[
            ConnectionInfo(name=c.get("name", ""), type=c.get("type", ""))
            for c in connections_result
        ],
    )


# =============================================================================
# Server-Group Assignment (Admin only)
# =============================================================================


@router.get("/{server_id}/groups", response_model=ServerGroupsResponse)
async def list_server_groups(
    server_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ServerGroupsResponse:
    """List groups assigned to a server. Requires auditor role or higher."""
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.groups).selectinload(ServerGroup.group))
        .where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    return ServerGroupsResponse(
        server_id=server.id,
        server_name=server.name,
        groups=[
            ServerGroupResponse(
                group_id=sg.group.id,
                group_name=sg.group.name,
                assigned_at=sg.assigned_at.isoformat(),
                assigned_by=sg.assigned_by,
            )
            for sg in server.groups
        ],
        total=len(server.groups),
    )


@router.post(
    "/{server_id}/groups/{group_id}",
    status_code=status.HTTP_201_CREATED,
)
async def assign_server_to_group(
    server_id: UUID,
    group_id: UUID,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ServerGroupsResponse:
    """Assign a server to a group. Requires admin role.

    Users in the group will be able to see and target this server for executions.
    """
    # Verify server exists
    server_result = await db.execute(
        select(Server)
        .options(selectinload(Server.groups).selectinload(ServerGroup.group))
        .where(Server.id == server_id)
    )
    server = server_result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    # Verify group exists
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Check if already assigned
    existing = await db.execute(
        select(ServerGroup).where(
            ServerGroup.server_id == server_id,
            ServerGroup.group_id == group_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Server '{server.name}' is already assigned to group '{group.name}'",
        )

    # Create assignment
    assignment = ServerGroup(
        server_id=server_id,
        group_id=group_id,
        assigned_by=admin.username,
    )
    db.add(assignment)
    await db.commit()

    logger.info(
        f"Assigned server '{server.name}' to group '{group.name}' by {admin.username}"
    )

    # Refresh and return updated groups
    await db.refresh(server)
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.groups).selectinload(ServerGroup.group))
        .where(Server.id == server_id)
    )
    server = result.scalar_one()

    return ServerGroupsResponse(
        server_id=server.id,
        server_name=server.name,
        groups=[
            ServerGroupResponse(
                group_id=sg.group.id,
                group_name=sg.group.name,
                assigned_at=sg.assigned_at.isoformat(),
                assigned_by=sg.assigned_by,
            )
            for sg in server.groups
        ],
        total=len(server.groups),
    )


@router.delete(
    "/{server_id}/groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_server_from_group(
    server_id: UUID,
    group_id: UUID,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a server from a group. Requires admin role.

    Users in the group will no longer be able to see or target this server.
    """
    # Verify server exists
    server_result = await db.execute(select(Server).where(Server.id == server_id))
    server = server_result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )

    # Find the assignment
    result = await db.execute(
        select(ServerGroup).where(
            ServerGroup.server_id == server_id,
            ServerGroup.group_id == group_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server is not assigned to this group",
        )

    await db.delete(assignment)
    await db.commit()

    logger.info(
        f"Removed server '{server.name}' from group {group_id} by {admin.username}"
    )
