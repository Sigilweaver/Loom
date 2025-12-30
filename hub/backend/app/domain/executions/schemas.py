"""Pydantic schemas for execution records and audit events."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field  # noqa: I001


# =============================================================================
# Execution Report Schemas (Server -> Hub)
# =============================================================================


class ExecutionReportSchema(BaseModel):
    """Report sent by Server after execution completes."""

    status: str = Field(..., description="Execution status: completed, failed, cancelled")
    success: bool = Field(..., description="Whether execution succeeded")
    started_at: datetime = Field(..., description="When execution started")
    completed_at: datetime | None = Field(None, description="When execution completed")
    duration_ms: int | None = Field(None, description="Execution duration in milliseconds")
    output_rows: int | None = Field(None, description="Number of output rows")
    output_columns: int | None = Field(None, description="Number of output columns")
    output_bytes: int | None = Field(None, description="Output size in bytes")
    error_type: str | None = Field(None, description="Error type if failed")
    connection_ids: list[str] = Field(default_factory=list, description="Connection IDs used")
    details: dict = Field(default_factory=dict, description="Rich execution details")


# =============================================================================
# Execution Record Response Schemas
# =============================================================================


class ExecutionRecordResponse(BaseModel):
    """Full execution record response."""

    id: UUID
    execution_id: UUID
    status: str
    success: bool
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
    output_rows: int | None
    output_columns: int | None
    output_bytes: int | None
    error_type: str | None
    connection_ids: list[str]
    details: dict


class ExecutionRecordSummary(BaseModel):
    """Summary for list views (without full details)."""

    id: UUID
    execution_id: UUID
    status: str
    success: bool
    started_at: datetime
    duration_ms: int | None
    output_rows: int | None
    error_type: str | None


class ExecutionRecordListResponse(BaseModel):
    """Paginated list of execution record summaries."""

    records: list[ExecutionRecordSummary]
    total: int


# =============================================================================
# Audit Event Schemas
# =============================================================================


class AuditEventResponse(BaseModel):
    """Audit event response."""

    id: UUID
    timestamp: datetime
    event_type: str
    execution_id: UUID | None
    workflow_id: UUID | None
    schedule_id: UUID | None
    actor_type: str
    actor_id: UUID | None
    actor_identity: str
    auth_method: str | None
    client_ip: str | None
    user_agent: str | None
    server_id: UUID | None
    details: dict
    event_hash: str
    previous_hash: str | None


class AuditEventListResponse(BaseModel):
    """Paginated list of audit events."""

    events: list[AuditEventResponse]
    total: int


class AuditChainVerifyResponse(BaseModel):
    """Result of audit chain verification."""

    valid: bool
    events_checked: int
    first_event_id: str | None
    last_event_id: str | None
    error: str | None = None
