"""Audit event routes.

Provides endpoints for querying and verifying audit events.
Requires auditor role or higher for access.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import RequireAuditor
from app.db.database import get_db
from app.db.models import AuditEvent
from app.domain.audit import AuditService
from app.domain.auth.sessions import SessionInfo
from app.domain.executions.schemas import (
    AuditChainVerifyResponse,
    AuditEventListResponse,
    AuditEventResponse,
)

router = APIRouter(prefix="/audit", tags=["audit"])


def _event_to_response(event: AuditEvent) -> AuditEventResponse:
    """Convert AuditEvent model to API response."""
    return AuditEventResponse(
        id=event.id,
        timestamp=event.timestamp,
        event_type=event.event_type,
        execution_id=event.execution_id,
        workflow_id=event.workflow_id,
        schedule_id=event.schedule_id,
        actor_type=event.actor_type,
        actor_id=event.actor_id,
        actor_identity=event.actor_identity,
        auth_method=event.auth_method,
        client_ip=event.client_ip,
        user_agent=event.user_agent,
        server_id=event.server_id,
        details=event.details,
        event_hash=event.event_hash,
        previous_hash=event.previous_hash,
    )


@router.get("/events", response_model=AuditEventListResponse)
async def list_audit_events(
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
    execution_id: UUID | None = Query(None, description="Filter by execution ID"),
    workflow_id: UUID | None = Query(None, description="Filter by workflow ID"),
    actor_id: UUID | None = Query(None, description="Filter by actor ID"),
    event_type: str | None = Query(None, description="Filter by event type"),
    from_date: datetime | None = Query(None, description="Filter events after this time"),
    to_date: datetime | None = Query(None, description="Filter events before this time"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Results per page"),
) -> AuditEventListResponse:
    """List audit events with filtering. Requires auditor role or higher.

    Query parameters:
    - execution_id: Filter by execution
    - workflow_id: Filter by workflow
    - actor_id: Filter by actor
    - event_type: Filter by event type (e.g., execution.requested)
    - from_date: Filter events after this time (ISO format)
    - to_date: Filter events before this time (ISO format)
    - page: Page number (default 1)
    - page_size: Results per page (default 50, max 200)
    """
    service = AuditService(db)
    offset = (page - 1) * page_size

    events, total = await service.list_events(
        execution_id=execution_id,
        workflow_id=workflow_id,
        actor_id=actor_id,
        event_type=event_type,
        from_date=from_date,
        to_date=to_date,
        limit=page_size,
        offset=offset,
    )

    return AuditEventListResponse(
        events=[_event_to_response(e) for e in events],
        total=total,
    )


@router.get("/verify", response_model=AuditChainVerifyResponse)
async def verify_audit_chain(
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(1000, ge=1, le=10000, description="Number of recent events to verify"),
) -> AuditChainVerifyResponse:
    """Verify hash chain integrity for recent audit events.

    Checks that each event's hash correctly includes the previous
    event's hash, detecting any tampering.

    Args:
        limit: Number of recent events to verify (default 1000, max 10000).

    Returns:
        Verification result with validity status and any errors.
    """
    service = AuditService(db)
    result = await service.verify_chain(limit=limit)

    return AuditChainVerifyResponse(
        valid=result["valid"],
        events_checked=result["events_checked"],
        first_event_id=result.get("first_event_id"),
        last_event_id=result.get("last_event_id"),
        error=result.get("error"),
    )
