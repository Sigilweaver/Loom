"""Execution management routes"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/executions")


class ExecutionTrigger(BaseModel):
    """Request to trigger an execution"""
    workflow_id: UUID
    server_id: UUID | None = None  # None = auto-select (round-robin)


class ExecutionResponse(BaseModel):
    """Execution details"""
    id: UUID
    workflow_id: UUID
    workflow_name: str
    server_id: UUID
    server_name: str
    trigger_type: str  # manual, scheduled, api
    triggered_by: str | None
    status: str  # queued, running, completed, failed
    queued_at: str
    started_at: str | None
    completed_at: str | None
    success: bool | None
    error_message: str | None
    duration_seconds: float | None


class ExecutionListResponse(BaseModel):
    """List of executions"""
    executions: list[ExecutionResponse]
    total: int


@router.get("", response_model=ExecutionListResponse)
async def list_executions(
    workflow_id: UUID | None = None,
    server_id: UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ExecutionListResponse:
    """List execution history, optionally filtered"""
    # TODO: Implement with database
    return ExecutionListResponse(
        executions=[],
        total=0,
    )


@router.post("", response_model=ExecutionResponse, status_code=status.HTTP_201_CREATED)
async def trigger_execution(request: ExecutionTrigger) -> ExecutionResponse:
    """Trigger a workflow execution"""
    # TODO: Implement
    # 1. Load workflow from storage
    # 2. Select server (specified or round-robin)
    # 3. Send workflow to server's /api/workflow/execute
    # 4. Record execution in database
    # 5. Return execution record
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Execution triggering not yet implemented",
    )


@router.get("/{execution_id}", response_model=ExecutionResponse)
async def get_execution(execution_id: UUID) -> ExecutionResponse:
    """Get execution details"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Execution not found",
    )
