"""Pydantic models for execution management."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TriggerType(str, Enum):
    """How an execution was triggered."""

    MANUAL = "manual"
    SCHEDULED = "scheduled"
    API = "api"


class ExecutionStatus(str, Enum):
    """Execution lifecycle status."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionInfo(BaseModel):
    """Execution record with resolved names."""

    id: UUID
    workflow_id: UUID
    workflow_name: str
    server_id: UUID
    server_name: str
    trigger_type: TriggerType
    triggered_by: str | None
    schedule_id: UUID | None
    status: ExecutionStatus
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    success: bool | None
    error_message: str | None
    duration_seconds: float | None


class TriggerExecutionInput(BaseModel):
    """Input for triggering an execution."""

    workflow_id: UUID
    server_id: UUID | None = None  # None = auto-select


class ExecutionResult(BaseModel):
    """Result from server after execution."""

    success: bool
    error_message: str | None = None
    duration_seconds: float | None = None
    outputs: dict[str, Any] | None = None
