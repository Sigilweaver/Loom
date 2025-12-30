"""Capability endpoints for workflow execution authorization.

These endpoints issue server tokens that authorize workflow execution.
Users authenticate with their Hub session token and receive a short-lived
server token that can be used to execute on a specific server.

The flow:
1. User sends workflow JSON to /api/capabilities/execute
2. Hub validates user session and connection access
3. Hub selects a healthy server and issues a server token
4. User receives token and server endpoint to call
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.db.database import get_db
from app.db.models import Connection, ConnectionGroup, Server, UserGroup
from app.domain.audit import AuditService
from app.domain.capabilities import CapabilityIssuer, get_issuer

router = APIRouter(prefix="/capabilities", tags=["capabilities"])
logger = logging.getLogger(__name__)


class ExecuteCapabilityRequest(BaseModel):
    """Request for execution capability."""

    workflow: dict = Field(..., description="Full workflow JSON")
    server_id: UUID | None = Field(
        None, description="Optional: specific server to use (otherwise auto-selected)"
    )


class PreviewCapabilityRequest(BaseModel):
    """Request for preview capability."""

    workflow: dict = Field(..., description="Full workflow JSON")
    server_id: UUID | None = Field(
        None, description="Optional: specific server to use (otherwise auto-selected)"
    )


class CapabilityResponse(BaseModel):
    """Response with server token and endpoint."""

    token: str = Field(..., description="Server token for authorization")
    server_endpoint: str = Field(..., description="Server URL to send execution request to")
    expires_in: int = Field(..., description="Token lifetime in seconds")


async def _select_healthy_server(
    db: AsyncSession,
    server_id: UUID | None = None,
) -> Server:
    """Select a healthy server for execution.

    If server_id is specified, returns that server if healthy.
    Otherwise, selects a healthy server (simple round-robin for now).

    Args:
        db: Database session.
        server_id: Optional specific server ID.

    Returns:
        A healthy Server instance.

    Raises:
        HTTPException: If no healthy server is available.
    """
    if server_id:
        # Fetch specific server
        result = await db.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Server {server_id} not found",
            )

        if server.status != "online":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Server {server.name} is not online (status: {server.status})",
            )

        return server

    # Select any online server (TODO: implement proper load balancing)
    result = await db.execute(
        select(Server).where(Server.status == "online").order_by(Server.last_poll.desc())
    )
    server = result.scalars().first()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No online servers available",
        )

    return server


async def _validate_connection_access(
    user: CurrentUser,
    connection_ids: list[str],
    db: AsyncSession,
) -> None:
    """Validate user has access to the specified connections.

    Access is granted if:
    1. User has admin or owner role (can access all connections), OR
    2. User is a member of at least one group that the connection is assigned to

    Connections with no group assignments are accessible by admins only.

    Args:
        user: Current authenticated user.
        connection_ids: List of connection IDs to validate.
        db: Database session.

    Raises:
        HTTPException: If user doesn't have access to a connection.
    """
    if not connection_ids:
        return  # No hub connections to validate

    # Admins/Owners can access all connections
    if user.role in ("owner", "admin"):
        logger.debug(f"Admin/owner {user.username} accessing connections: {connection_ids}")
        return

    # Get user's group memberships
    user_groups_result = await db.execute(
        select(UserGroup.group_id).where(UserGroup.user_id == user.user_id)
    )
    user_group_ids = {row[0] for row in user_groups_result.fetchall()}

    if not user_group_ids:
        # User not in any groups - cannot access any connections
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of any groups and cannot access Hub connections",
        )

    # Check each connection
    unauthorized = []
    for conn_id_str in connection_ids:
        try:
            from uuid import UUID
            conn_id = UUID(conn_id_str)
        except ValueError:
            unauthorized.append(conn_id_str)
            continue

        # Check if connection exists
        conn_result = await db.execute(
            select(Connection.id).where(Connection.id == conn_id)
        )
        if not conn_result.scalar_one_or_none():
            unauthorized.append(conn_id_str)
            continue

        # Get groups this connection is assigned to
        conn_groups_result = await db.execute(
            select(ConnectionGroup.group_id).where(ConnectionGroup.connection_id == conn_id)
        )
        conn_group_ids = {row[0] for row in conn_groups_result.fetchall()}

        if not conn_group_ids:
            # Connection not assigned to any groups - only admins can access
            unauthorized.append(conn_id_str)
            continue

        # Check if user shares at least one group with the connection
        if not user_group_ids.intersection(conn_group_ids):
            unauthorized.append(conn_id_str)

    if unauthorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to the following connections: {unauthorized}",
        )


@router.post("/execute", response_model=CapabilityResponse)
async def request_execute_capability(
    request: ExecuteCapabilityRequest,
    current_user: CurrentUser,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    issuer: CapabilityIssuer = Depends(get_issuer),
) -> CapabilityResponse:
    """Request authorization to execute a workflow.

    Returns a server token that can be used to execute the workflow
    on the designated server. The token is short-lived (default 5 minutes)
    and single-use.

    The workflow JSON is hashed and embedded in the token, so the server
    can verify the workflow hasn't been modified.
    """
    # Extract hub connections and validate access
    connection_ids = issuer.extract_hub_connections(request.workflow)
    await _validate_connection_access(current_user, connection_ids, db)

    # Select a healthy server
    server = await _select_healthy_server(db, request.server_id)

    # Issue the token
    capability = await issuer.issue_execute_token(
        user_id=str(current_user.user_id),
        server=server,
        workflow_json=request.workflow,
    )

    # Log audit events
    audit_service = AuditService(db)
    workflow_id = request.workflow.get("workflowId")

    # Get client IP
    client_ip = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

    # Log execution.requested
    await audit_service.log_event(
        event_type="execution.requested",
        actor_type="user",
        actor_identity=current_user.username,
        actor_id=current_user.user_id,
        workflow_id=UUID(workflow_id) if workflow_id else None,
        server_id=server.id,
        auth_method="session",
        client_ip=client_ip,
        user_agent=user_agent,
        details={
            "workflow_name": request.workflow.get("name"),
            "connection_ids": connection_ids,
            "server_name": server.name,
        },
    )

    # Log execution.token_issued
    await audit_service.log_event(
        event_type="execution.token_issued",
        actor_type="system",
        actor_identity="hub",
        workflow_id=UUID(workflow_id) if workflow_id else None,
        server_id=server.id,
        details={
            "scope": "execute",
            "expires_in": capability.expires_in,
            "target_server": server.name,
        },
    )

    await db.commit()

    logger.info(
        f"Issued execute capability for user {current_user.username} "
        f"on server {server.name}"
    )

    return CapabilityResponse(
        token=capability.token,
        server_endpoint=capability.server_endpoint,
        expires_in=capability.expires_in,
    )


@router.post("/preview", response_model=CapabilityResponse)
async def request_preview_capability(
    request: PreviewCapabilityRequest,
    current_user: CurrentUser,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    issuer: CapabilityIssuer = Depends(get_issuer),
) -> CapabilityResponse:
    """Request authorization to preview a workflow.

    Similar to /execute but issues a token with 'preview' scope.
    Servers may apply different limits for preview operations.
    """
    # Extract hub connections and validate access
    connection_ids = issuer.extract_hub_connections(request.workflow)
    await _validate_connection_access(current_user, connection_ids, db)

    # Select a healthy server
    server = await _select_healthy_server(db, request.server_id)

    # Issue the token
    capability = await issuer.issue_preview_token(
        user_id=str(current_user.user_id),
        server=server,
        workflow_json=request.workflow,
    )

    # Log audit events
    audit_service = AuditService(db)
    workflow_id = request.workflow.get("workflowId")

    # Get client IP
    client_ip = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

    # Log execution.requested for preview
    await audit_service.log_event(
        event_type="execution.requested",
        actor_type="user",
        actor_identity=current_user.username,
        actor_id=current_user.user_id,
        workflow_id=UUID(workflow_id) if workflow_id else None,
        server_id=server.id,
        auth_method="session",
        client_ip=client_ip,
        user_agent=user_agent,
        details={
            "workflow_name": request.workflow.get("name"),
            "connection_ids": connection_ids,
            "server_name": server.name,
            "scope": "preview",
        },
    )

    # Log execution.token_issued
    await audit_service.log_event(
        event_type="execution.token_issued",
        actor_type="system",
        actor_identity="hub",
        workflow_id=UUID(workflow_id) if workflow_id else None,
        server_id=server.id,
        details={
            "scope": "preview",
            "expires_in": capability.expires_in,
            "target_server": server.name,
        },
    )

    await db.commit()

    logger.info(
        f"Issued preview capability for user {current_user.username} "
        f"on server {server.name}"
    )

    return CapabilityResponse(
        token=capability.token,
        server_endpoint=capability.server_endpoint,
        expires_in=capability.expires_in,
    )
