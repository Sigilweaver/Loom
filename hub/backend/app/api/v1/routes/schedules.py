"""Schedule management routes.

Provides endpoints for managing workflow schedules.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAuditor, RequireUser
from app.db.database import get_db
from app.domain.auth.roles import get_role_level, Role
from app.domain.auth.sessions import SessionInfo
from app.domain.executions import (
    ExecutionInfo,
    ExecutionService,
    TriggerExecutionInput,
    TriggerType,
)
from app.domain.schedules import (
    CreateScheduleInput,
    ScheduleInfo,
    ScheduleNotFoundError,
    ScheduleService,
    ServerNotFoundError,
    UpdateScheduleInput,
    WorkflowNotFoundError,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _to_iso_utc(dt: datetime) -> str:
    """Convert datetime to ISO format with UTC timezone suffix."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


def _parse_iso_datetime(iso_str: str | None) -> datetime | None:
    """Parse ISO datetime string to timezone-aware datetime."""
    if not iso_str:
        return None
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


class ScheduleCreate(BaseModel):
    """Request to create a schedule."""

    workflow_id: UUID
    cron_expression: str  # e.g., "0 6 * * *" (6 AM daily)
    timezone: str = "UTC"
    start_at: str | None = None  # ISO datetime - don't trigger before this
    target_server_id: UUID | None = None  # None = round-robin
    enabled: bool = True
    description: str | None = None


class ScheduleUpdate(BaseModel):
    """Request to update a schedule."""

    cron_expression: str | None = None
    timezone: str | None = None
    start_at: str | None = None  # ISO datetime
    target_server_id: UUID | None = None
    enabled: bool | None = None
    description: str | None = None


class ScheduleResponse(BaseModel):
    """Schedule details."""

    id: UUID
    workflow_id: UUID
    workflow_name: str | None
    cron_expression: str
    timezone: str
    start_at: str | None
    target_server_id: UUID | None
    target_server_name: str | None
    enabled: bool
    description: str | None
    created_by: str | None
    created_at: str
    updated_at: str | None
    last_triggered_at: str | None
    next_trigger_at: str | None


class ScheduleListResponse(BaseModel):
    """List of schedules."""

    schedules: list[ScheduleResponse]
    total: int


class ExecutionResponse(BaseModel):
    """Execution details (for trigger response)."""

    id: UUID
    workflow_id: UUID
    server_id: UUID
    status: str
    queued_at: str


def _info_to_response(info: ScheduleInfo) -> ScheduleResponse:
    """Convert ScheduleInfo to API response."""
    return ScheduleResponse(
        id=info.id,
        workflow_id=info.workflow_id,
        workflow_name=info.workflow_name,
        cron_expression=info.cron_expression,
        timezone=info.timezone,
        start_at=_to_iso_utc(info.start_at) if info.start_at else None,
        target_server_id=info.target_server_id,
        target_server_name=info.target_server_name,
        enabled=info.enabled,
        description=info.description,
        created_by=info.created_by,
        created_at=_to_iso_utc(info.created_at),
        updated_at=_to_iso_utc(info.updated_at) if info.updated_at else None,
        last_triggered_at=(
            _to_iso_utc(info.last_triggered_at) if info.last_triggered_at else None
        ),
        next_trigger_at=(
            _to_iso_utc(info.next_trigger_at) if info.next_trigger_at else None
        ),
    )


def _execution_to_response(info: ExecutionInfo) -> ExecutionResponse:
    """Convert ExecutionInfo to minimal API response."""
    return ExecutionResponse(
        id=info.id,
        workflow_id=info.workflow_id,
        server_id=info.server_id,
        status=info.status.value,
        queued_at=_to_iso_utc(info.queued_at),
    )


# =============================================================================
# Schedule List/Search
# =============================================================================


@router.get("", response_model=ScheduleListResponse)
async def list_schedules(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    workflow_id: UUID | None = Query(None),
    enabled: bool | None = Query(None),
    created_by: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ScheduleListResponse:
    """List schedules with filtering.

    For regular users: Returns only their own schedules.
    For auditor+: Returns all schedules (can filter by created_by).

    Query parameters:
    - workflow_id: Filter by workflow
    - enabled: Filter by enabled status
    - created_by: Filter by creator username (auditor+ only)
    - limit: Maximum results (default 50)
    - offset: Skip results for pagination
    """
    service = ScheduleService(db)

    # Regular users can only see their own schedules
    auditor_level = get_role_level(Role.AUDITOR)
    user_level = get_role_level(user.role)

    if user_level > auditor_level:
        # Regular user - force filter to own schedules
        filter_by = user.username
    else:
        # Auditor+ - can see all, optionally filter
        filter_by = created_by

    schedules, total = await service.list_schedules(
        workflow_id=workflow_id,
        enabled_only=enabled if enabled else False,
        created_by=filter_by,
        skip=offset,
        limit=limit,
    )

    return ScheduleListResponse(
        schedules=[_info_to_response(s) for s in schedules],
        total=total,
    )


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    request: ScheduleCreate,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    """Create a new schedule. Requires user role.

    The schedule will be registered with the scheduler and will start
    triggering executions according to the cron expression.
    """
    service = ScheduleService(db)

    try:
        input = CreateScheduleInput(
            workflow_id=request.workflow_id,
            target_server_id=request.target_server_id,
            cron_expression=request.cron_expression,
            timezone=request.timezone,
            start_at=_parse_iso_datetime(request.start_at),
            enabled=request.enabled,
            description=request.description,
        )
        schedule = await service.create_schedule(input, created_by=user.username)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ServerNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _info_to_response(schedule)


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    """Get schedule details. Requires auditor role or higher."""
    service = ScheduleService(db)

    try:
        schedule = await service.get_schedule(schedule_id)
    except ScheduleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found",
        )

    return _info_to_response(schedule)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    request: ScheduleUpdate,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    """Update a schedule. Requires user role.

    The scheduler will be updated with the new configuration.
    Users can only update their own schedules.
    """
    service = ScheduleService(db)

    # Check ownership first
    try:
        existing = await service.get_schedule(schedule_id)
    except ScheduleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found",
        )

    if existing.created_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update schedules created by other users",
        )

    try:
        # Only include fields that were actually provided in the request
        request_data = request.model_dump(exclude_unset=True)
        
        # Parse start_at if provided
        if "start_at" in request_data:
            request_data["start_at"] = _parse_iso_datetime(request_data["start_at"])
        
        input = UpdateScheduleInput(**request_data)
        schedule = await service.update_schedule(schedule_id, input)
    except ServerNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _info_to_response(schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a schedule.

    The schedule will be removed from the scheduler.
    Users can delete their own schedules.
    Admins/owners can delete any schedule.
    Auditors cannot delete schedules.
    """
    service = ScheduleService(db)

    try:
        schedule = await service.get_schedule(schedule_id)
    except ScheduleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found",
        )

    # Only owner/admin can delete any schedule; users can only delete their own
    # Auditors cannot delete schedules at all
    if user.role == "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditors cannot delete schedules",
        )
    if user.role == "user" and schedule.created_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete schedules created by other users",
        )

    await service.delete_schedule(schedule_id)


@router.post("/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(
    schedule_id: UUID,
    enabled: bool = Query(...),
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    """Enable or disable a schedule. Requires user role."""
    service = ScheduleService(db)

    # Check ownership first
    try:
        existing = await service.get_schedule(schedule_id)
    except ScheduleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found",
        )

    if existing.created_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify schedules created by other users",
        )

    schedule = await service.toggle_schedule(schedule_id, enabled)
    return _info_to_response(schedule)


@router.post("/{schedule_id}/trigger", response_model=ExecutionResponse)
async def trigger_schedule(
    schedule_id: UUID,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> ExecutionResponse:
    """Manually trigger a schedule immediately. Requires user role.

    Creates an execution with trigger_type=manual for this schedule's workflow.
    Users can only trigger their own schedules.
    """
    schedule_service = ScheduleService(db)
    execution_service = ExecutionService(db)

    try:
        schedule = await schedule_service.get_schedule(schedule_id)
    except ScheduleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} not found",
        )

    # Check ownership
    if schedule.created_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot trigger schedules created by other users",
        )

    try:
        input = TriggerExecutionInput(
            workflow_id=schedule.workflow_id,
            server_id=schedule.target_server_id,
        )
        execution = await execution_service.trigger_execution(
            input=input,
            triggered_by=user.username,
            trigger_type=TriggerType.MANUAL,
            schedule_id=schedule_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger execution: {e}",
        )

    return _execution_to_response(execution)
