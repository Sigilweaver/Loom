"""Pydantic models for schedule management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScheduleInfo(BaseModel):
    """Schedule record with resolved names."""

    id: UUID
    workflow_id: UUID
    workflow_name: str | None
    cron_expression: str
    timezone: str
    start_at: datetime | None
    target_server_id: UUID | None
    target_server_name: str | None
    enabled: bool
    description: str | None
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None
    last_triggered_at: datetime | None
    next_trigger_at: datetime | None


class CreateScheduleInput(BaseModel):
    """Input for creating a schedule."""

    workflow_id: UUID
    cron_expression: str = Field(
        ...,
        description="Cron expression (5 fields: minute hour day month weekday)",
        pattern=r"^[\d\*\-\,\/]+\s+[\d\*\-\,\/]+\s+[\d\*\-\,\/\?LW]+\s+[\d\*\-\,\/]+\s+[\d\*\-\,\/\?L#]+$",
    )
    timezone: str = "UTC"
    start_at: datetime | None = None  # Don't trigger before this time
    target_server_id: UUID | None = None  # None = round-robin
    enabled: bool = True
    description: str | None = None


class UpdateScheduleInput(BaseModel):
    """Input for updating a schedule."""

    cron_expression: str | None = Field(
        None,
        pattern=r"^[\d\*\-\,\/]+\s+[\d\*\-\,\/]+\s+[\d\*\-\,\/\?LW]+\s+[\d\*\-\,\/]+\s+[\d\*\-\,\/\?L#]+$",
    )
    timezone: str | None = None
    start_at: datetime | None = None
    target_server_id: UUID | None = None
    enabled: bool | None = None
    description: str | None = None
