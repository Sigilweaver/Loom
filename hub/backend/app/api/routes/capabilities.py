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

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.db.database import get_db
from app.db.models import Server
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

        if server.status != "healthy":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Server {server.name} is not healthy (status: {server.status})",
            )

        return server

    # Select any healthy server (TODO: implement proper load balancing)
    result = await db.execute(
        select(Server).where(Server.status == "healthy").order_by(Server.last_poll.desc())
    )
    server = result.scalars().first()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No healthy servers available",
        )

    return server


async def _validate_connection_access(
    user: CurrentUser,
    connection_ids: list[str],
    db: AsyncSession,
) -> None:
    """Validate user has access to the specified connections.

    For Phase 2, we just check that the connections exist in Hub.
    Future: implement per-user connection permissions.

    Args:
        user: Current authenticated user.
        connection_ids: List of connection IDs to validate.
        db: Database session.

    Raises:
        HTTPException: If user doesn't have access to a connection.
    """
    if not connection_ids:
        return  # No hub connections to validate

    # TODO: Phase 3 - query Connection table and validate access
    # For now, we just log and allow (connections don't exist yet)
    logger.debug(
        f"Connection access check for user {user.username}: {connection_ids} (not yet implemented)"
    )


@router.post("/execute", response_model=CapabilityResponse)
async def request_execute_capability(
    request: ExecuteCapabilityRequest,
    current_user: CurrentUser,
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

    logger.info(
        f"Issued preview capability for user {current_user.username} "
        f"on server {server.name}"
    )

    return CapabilityResponse(
        token=capability.token,
        server_endpoint=capability.server_endpoint,
        expires_in=capability.expires_in,
    )
