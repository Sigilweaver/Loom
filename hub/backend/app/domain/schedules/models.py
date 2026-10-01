"""Pydantic models for schedule management."""

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from .cron import cron_trigger


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
        description="Five cron fields; weekday 0/7 is Sunday, 1 is Monday",
    )
    timezone: str = "UTC"
    start_at: datetime | None = None  # Don't trigger before this time
    target_server_id: UUID | None = None  # None = least-loaded online server
    enabled: bool = True
    description: str | None = None

    @model_validator(mode="after")
    def validate_cron(self) -> Self:
        cron_trigger(self.cron_expression, self.timezone, self.start_at)
        return self


class UpdateScheduleInput(BaseModel):
    """Input for updating a schedule."""

    cron_expression: str | None = None
    timezone: str | None = None
    start_at: datetime | None = None
    target_server_id: UUID | None = None
    enabled: bool | None = None
    description: str | None = None

    @model_validator(mode="after")
    def validate_cron(self) -> Self:
        for field in ("cron_expression", "timezone", "enabled"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        cron_trigger(
            self.cron_expression if self.cron_expression is not None else "* * * * *",
            self.timezone if self.timezone is not None else "UTC",
            self.start_at,
        )
        return self
