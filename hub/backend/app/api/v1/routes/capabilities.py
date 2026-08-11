"""Capability endpoints for server operation authorization.

These endpoints issue server tokens that authorize operations on servers.
Users authenticate with their Hub session token and receive a short-lived
server token that can be used with a specific server.

The simplified flow:
1. User requests a token via POST /token
2. Hub validates user session and selects a healthy server
3. Hub issues an opaque server token (stored in TokenStore)
4. User receives token and server endpoint
5. User sends request to Server with token
6. Server calls /internal/authorize with token + request details
7. Hub validates and returns credentials
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.config import settings as _rl_settings
from app.db.database import get_db
from app.db.models import Server
from app.domain.audit import AuditService
from app.domain.capabilities import CapabilityIssuer, get_issuer
from app.middleware.rate_limit import _user_or_ip
from app.middleware.rate_limit import limiter as _rl

router = APIRouter(prefix="/capabilities", tags=["capabilities"])
logger = logging.getLogger(__name__)


# =============================================================================
# Helpers
# =============================================================================


async def _select_healthy_server(
    db: AsyncSession,
    server_id: UUID | None = None,
) -> Server:
    """Select a healthy server, optionally by ID.

    Args:
        db: Database session.
        server_id: Optional specific server ID to use.

    Returns:
        Selected server.

    Raises:
        HTTPException: If no healthy server is available.
    """
    if server_id:
        # Specific server requested
        result = await db.execute(
            select(Server).where(Server.id == server_id)
        )
        server = result.scalar_one_or_none()
        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Server {server_id} not found",
            )
        if server.status != "online":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Server {server.name} is not healthy (status: {server.status})",
            )
        return server

    # Auto-select: find an online server (ordered by name for consistency)
    result = await db.execute(
        select(Server)
        .where(Server.status == "online")
        .order_by(Server.name)
    )
    servers = result.scalars().all()

    if not servers:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No healthy servers available",
        )

    return servers[0]


# =============================================================================
# Token API
# =============================================================================


class TokenRequest(BaseModel):
    """Request for a server token."""

    server_id: UUID | None = Field(
        None, description="Optional: specific server to use (otherwise auto-selected)"
    )


class TokenResponse(BaseModel):
    """Response with server token and endpoint."""

    token: str = Field(..., description="Opaque server token for authorization")
    server_endpoint: str = Field(..., description="Server URL to send requests to")
    expires_in: int = Field(..., description="Token lifetime in seconds")


@router.post("/token", response_model=TokenResponse)
# Authenticated route: key by user id (falling back to IP) so multiple users
# behind one NAT don't share a token-issuance budget, and a single user cycling
# IPs can't escape theirs. get_current_user populates request.state.user_id.
@_rl.limit(_rl_settings.rate_limit_capability_token, key_func=_user_or_ip)
async def request_token(
    request: TokenRequest,
    current_user: CurrentUser,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    issuer: CapabilityIssuer = Depends(get_issuer),
) -> TokenResponse:
    """Request a server token.

    Returns an opaque token that authorizes the user to make requests
    to the designated server. The token is short-lived (default 5 minutes)
    and single-use.

    The actual authorization (what operations are allowed, what connections
    can be accessed) happens when the server calls /internal/authorize.
    """
    # Select a healthy server
    server = await _select_healthy_server(db, request.server_id)

    # Issue the token
    capability = await issuer.issue_token(
        user_id=str(current_user.user_id),
        server=server,
    )

    # Log audit event
    audit_service = AuditService(db)
    client_ip = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

    await audit_service.log_event(
        event_type="capability.token_issued",
        actor_type="user",
        actor_identity=current_user.username,
        actor_id=current_user.user_id,
        server_id=server.id,
        auth_method="session",
        client_ip=client_ip,
        user_agent=user_agent,
        details={
            "server_name": server.name,
            "expires_in": capability.expires_in,
        },
    )

    await db.commit()

    logger.info(
        f"Issued server token for user {current_user.username} "
        f"on server {server.name}"
    )

    return TokenResponse(
        token=capability.token,
        server_endpoint=capability.server_endpoint,
        expires_in=capability.expires_in,
    )

