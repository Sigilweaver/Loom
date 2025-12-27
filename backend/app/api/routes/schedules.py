"""Schedule management routes"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/schedules")


class ScheduleCreate(BaseModel):
    """Request to create a schedule"""
    workflow_id: UUID
    cron_expression: str  # e.g., "0 6 * * *" (6 AM daily)
    timezone: str = "UTC"
    target_server_id: UUID | None = None  # None = round-robin
    timeout_seconds: int = 3600
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    """Request to update a schedule"""
    cron_expression: str | None = None
    timezone: str | None = None
    target_server_id: UUID | None = None
    timeout_seconds: int | None = None
    enabled: bool | None = None


class ScheduleResponse(BaseModel):
    """Schedule details"""
    id: UUID
    workflow_id: UUID
    workflow_name: str
    cron_expression: str
    timezone: str
    target_server_id: UUID | None
    target_server_name: str | None
    timeout_seconds: int
    enabled: bool
    created_by: str
    created_at: str
    last_triggered_at: str | None
    next_trigger_at: str | None


class ScheduleListResponse(BaseModel):
    """List of schedules"""
    schedules: list[ScheduleResponse]
    total: int


@router.get("", response_model=ScheduleListResponse)
async def list_schedules(
    workflow_id: UUID | None = None,
    enabled: bool | None = None,
) -> ScheduleListResponse:
    """List all schedules, optionally filtered"""
    # TODO: Implement with database
    return ScheduleListResponse(
        schedules=[],
        total=0,
    )


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(request: ScheduleCreate) -> ScheduleResponse:
    """Create a new schedule"""
    # TODO: Implement with database and APScheduler
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Schedule creation not yet implemented",
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: UUID) -> ScheduleResponse:
    """Get schedule details"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Schedule not found",
    )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(schedule_id: UUID, request: ScheduleUpdate) -> ScheduleResponse:
    """Update a schedule"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Schedule not found",
    )


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(schedule_id: UUID) -> None:
    """Delete a schedule"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Schedule not found",
    )


@router.post("/{schedule_id}/trigger", response_model=dict)
async def trigger_schedule(schedule_id: UUID) -> dict:
    """Manually trigger a schedule immediately"""
    # TODO: Implement - creates an execution with trigger_type=manual
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Schedule not found",
    )
