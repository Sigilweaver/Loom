"""Execution management routes.

Provides endpoints for triggering and tracking workflow executions.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAuditor, RequireUser
from app.db.database import get_db
from app.db.models import ExecutionRecord
from app.domain.auth.roles import get_role_level, Role
from app.domain.auth.sessions import SessionInfo
from app.domain.executions import (
    ExecutionInfo,
    ExecutionNotFoundError,
    ExecutionService,
    ExecutionServiceError,
    NoAvailableServerError,
    ServerNotFoundError,
    TriggerExecutionInput,
    TriggerType,
    WorkflowNotFoundError,
)
from app.domain.executions.schemas import (
    ExecutionRecordResponse,
    ExecutionRecordSummary,
)

router = APIRouter(prefix="/executions", tags=["executions"])


def _to_iso_utc(dt: datetime) -> str:
    """Convert datetime to ISO format with UTC timezone suffix."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


class ExecutionTrigger(BaseModel):
    """Request to trigger an execution."""

    workflow_id: UUID
    server_id: UUID | None = None  # None = auto-select (round-robin)


class ExecutionResponse(BaseModel):
    """Execution details."""

    id: UUID
    workflow_id: UUID
    workflow_name: str
    server_id: UUID
    server_name: str
    trigger_type: str  # manual, scheduled, api
    triggered_by: str | None
    schedule_id: UUID | None
    status: str  # queued, running, completed, failed, cancelled
    queued_at: str
    started_at: str | None
    completed_at: str | None
    success: bool | None
    error_message: str | None
    duration_seconds: float | None


class ExecutionListResponse(BaseModel):
    """List of executions."""

    executions: list[ExecutionResponse]
    total: int


def _info_to_response(info: ExecutionInfo) -> ExecutionResponse:
    """Convert ExecutionInfo to API response."""
    return ExecutionResponse(
        id=info.id,
        workflow_id=info.workflow_id,
        workflow_name=info.workflow_name,
        server_id=info.server_id,
        server_name=info.server_name,
        trigger_type=info.trigger_type.value,
        triggered_by=info.triggered_by,
        schedule_id=info.schedule_id,
        status=info.status.value,
        queued_at=_to_iso_utc(info.queued_at),
        started_at=_to_iso_utc(info.started_at) if info.started_at else None,
        completed_at=_to_iso_utc(info.completed_at) if info.completed_at else None,
        success=info.success,
        error_message=info.error_message,
        duration_seconds=info.duration_seconds,
    )


def _get_service(db: AsyncSession) -> ExecutionService:
    """Create ExecutionService instance."""
    return ExecutionService(db)


# =============================================================================
# Execution List/Search
# =============================================================================


@router.get("", response_model=ExecutionListResponse)
async def list_executions(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    workflow_id: UUID | None = Query(None),
    server_id: UUID | None = Query(None),
    status: str | None = Query(None),
    triggered_by: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExecutionListResponse:
    """List executions with filtering.

    For regular users: Returns only their own executions.
    For auditor+: Returns all executions (can filter by triggered_by).

    Query parameters:
    - workflow_id: Filter by workflow
    - server_id: Filter by server
    - status: Filter by status (queued, running, completed, failed, cancelled)
    - triggered_by: Filter by triggering username (auditor+ only)
    - limit: Maximum results (default 50, max 200)
    - offset: Pagination offset
    """
    service = _get_service(db)

    # Regular users can only see their own executions
    auditor_level = get_role_level(Role.AUDITOR)
    user_level = get_role_level(user.role)

    if user_level > auditor_level:
        # Regular user - force filter to own executions
        filter_by: str | None = user.username
    else:
        # Auditor+ - can see all, optionally filter
        filter_by = triggered_by

    executions, total = await service.list_executions(
        workflow_id=workflow_id,
        server_id=server_id,
        status=status,
        triggered_by=filter_by,
        limit=limit,
        offset=offset,
    )
    return ExecutionListResponse(
        executions=[_info_to_response(e) for e in executions],
        total=total,
    )


@router.post("", response_model=ExecutionResponse, status_code=status.HTTP_201_CREATED)
async def trigger_execution(
    request: ExecutionTrigger,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ExecutionResponse:
    """Trigger a workflow execution. Requires user role.

    Queues an execution and starts it asynchronously on the selected server.
    If no server_id is provided, an online server is selected automatically.
    """
    service = _get_service(db)

    try:
        input = TriggerExecutionInput(
            workflow_id=request.workflow_id,
            server_id=request.server_id,
        )
        info = await service.trigger_execution(
            input=input,
            triggered_by=user.username,
            trigger_type=TriggerType.MANUAL,
        )
        return _info_to_response(info)

    except NoAvailableServerError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except WorkflowNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ServerNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ExecutionServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ExecutionResponse:
    """Get execution details by ID. Requires auditor role or higher."""
    service = _get_service(db)

    try:
        info = await service.get_execution(execution_id)
        return _info_to_response(info)
    except ExecutionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )


@router.post("/{execution_id}/cancel", response_model=ExecutionResponse)
async def cancel_execution(
    execution_id: UUID,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ExecutionResponse:
    """Cancel a queued or running execution. Requires user role.

    Users can only cancel their own executions.
    """
    service = _get_service(db)

    # Check ownership first
    try:
        existing = await service.get_execution(execution_id)
    except ExecutionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    if existing.triggered_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot cancel executions triggered by other users",
        )

    try:
        info = await service.cancel_execution(execution_id)
        return _info_to_response(info)
    except ExecutionServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================================
# Execution Record Endpoints (Rich Details)
# =============================================================================


def _record_to_response(record: ExecutionRecord) -> ExecutionRecordResponse:
    """Convert ExecutionRecord model to full response."""
    return ExecutionRecordResponse(
        id=record.id,
        execution_id=record.execution_id,
        status=record.status,
        success=record.success,
        started_at=record.started_at,
        completed_at=record.completed_at,
        duration_ms=record.duration_ms,
        output_rows=record.output_rows,
        output_columns=record.output_columns,
        output_bytes=record.output_bytes,
        error_type=record.error_type,
        connection_ids=[str(c) for c in record.connection_ids] if record.connection_ids else [],
        details=record.details,
    )


def _record_to_summary(record: ExecutionRecord) -> ExecutionRecordSummary:
    """Convert ExecutionRecord model to summary (without full details)."""
    return ExecutionRecordSummary(
        id=record.id,
        execution_id=record.execution_id,
        status=record.status,
        success=record.success,
        started_at=record.started_at,
        duration_ms=record.duration_ms,
        output_rows=record.output_rows,
        error_type=record.error_type,
    )


@router.get("/{execution_id}/record", response_model=ExecutionRecordResponse)
async def get_execution_record(
    execution_id: UUID,
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ExecutionRecordResponse:
    """Get full execution record including rich details.

    Requires auditor role or higher.
    """
    result = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution record not found",
        )

    return _record_to_response(record)


@router.get("/{execution_id}/code")
async def get_execution_code(
    execution_id: UUID,
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get generated code for an execution.

    Requires auditor role or higher.
    """
    result = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution record not found",
        )

    return {"generated_code": record.details.get("generated_code")}


@router.get("/{execution_id}/plans")
async def get_execution_plans(
    execution_id: UUID,
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get query plans for an execution.

    Requires auditor role or higher.
    """
    result = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution record not found",
        )

    return {"plans": record.details.get("plans", {})}


@router.get("/{execution_id}/connections")
async def get_execution_connections(
    execution_id: UUID,
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get connection operations for an execution.

    Requires auditor role or higher.
    """
    result = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution record not found",
        )

    return {"connections": record.details.get("connections", [])}


@router.get("/{execution_id}/logs")
async def get_execution_logs(
    execution_id: UUID,
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get logs for an execution.

    Requires auditor role or higher.
    """
    result = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution record not found",
        )

    return {"logs": record.details.get("logs", [])}
