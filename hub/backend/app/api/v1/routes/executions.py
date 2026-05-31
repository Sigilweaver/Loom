"""Execution management routes.

Provides endpoints for triggering and tracking workflow executions.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAuditor, RequireUser
from app.db.database import get_db
from app.db.models import ExecutionRecord
from app.domain.artifacts import (
    ArtifactCorruptedError,
    ArtifactNotFoundError,
    ArtifactService,
    get_artifact_store,
)
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
from app.domain.executions.broker import GLOBAL_TOPIC, execution_broker
from app.domain.executions.schemas import (
    ExecutionRecordResponse,
    ExecutionRecordSummary,
)

router = APIRouter(prefix="/executions", tags=["executions"])

# Execution statuses after which no further events will be emitted.
_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})

# Idle interval before emitting an SSE comment to keep the connection (and any
# intermediary proxies) from timing the stream out.
_SSE_HEARTBEAT_SECONDS = 15.0


def _sse_event(data: str, event: str | None = None) -> str:
    """Format a Server-Sent Events frame."""
    lines: list[str] = []
    if event is not None:
        lines.append(f"event: {event}")
    for line in data.split("\n"):
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"



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


class ArtifactResponse(BaseModel):
    """Metadata for a stored execution output artifact."""

    id: UUID
    execution_id: UUID
    name: str
    media_type: str
    sha256: str
    size_bytes: int
    row_count: int | None
    created_at: str


class ArtifactListResponse(BaseModel):
    """List of artifacts for an execution."""

    artifacts: list[ArtifactResponse]
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


# =============================================================================
# Live Execution Streaming (Server-Sent Events)
# =============================================================================


@router.get("/stream")
async def stream_executions(
    request: Request,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream live execution status updates as Server-Sent Events.

    Powers the dashboard's live view without polling on a single-node Hub.
    Regular users only receive events for their own executions; auditor+ see
    all. Each ``update`` event carries the same shape as the REST execution
    response. The stream stays open indefinitely, emitting heartbeat comments
    while idle, and ends when the client disconnects.
    """
    is_auditor = get_role_level(user.role) <= get_role_level(Role.AUDITOR)
    username = user.username

    async def event_stream() -> AsyncGenerator[str, None]:
        with execution_broker.subscribe(GLOBAL_TOPIC) as queue:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(
                        queue.get(), timeout=_SSE_HEARTBEAT_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                if not is_auditor and event.get("triggered_by") != username:
                    continue
                yield _sse_event(json.dumps(event), event="update")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{execution_id}/stream")
async def stream_execution(
    execution_id: UUID,
    request: Request,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a single execution's status updates as Server-Sent Events.

    Accessible to auditor+ or the user who triggered the execution. Emits the
    current state immediately on connect, then live deltas, and closes once the
    execution reaches a terminal status.
    """
    await _require_execution_access(execution_id, user, db)
    service = _get_service(db)

    async def event_stream() -> AsyncGenerator[str, None]:
        # Subscribe before reading the snapshot so no transition is missed in
        # the window between the snapshot and the first delivered event.
        with execution_broker.subscribe(str(execution_id)) as queue:
            try:
                snapshot = await service.get_execution(execution_id)
            except ExecutionNotFoundError:
                return
            snapshot_data = _info_to_response(snapshot).model_dump(mode="json")
            yield _sse_event(json.dumps(snapshot_data), event="update")
            if snapshot_data["status"] in _TERMINAL_STATUSES:
                return

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(
                        queue.get(), timeout=_SSE_HEARTBEAT_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield _sse_event(json.dumps(event), event="update")
                if event.get("status") in _TERMINAL_STATUSES:
                    break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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


# =============================================================================
# Execution Artifact Endpoints (output storage + retrieval)
# =============================================================================


def _artifact_to_response(artifact: Any) -> ArtifactResponse:
    """Convert an ExecutionArtifact model to its API response."""
    return ArtifactResponse(
        id=artifact.id,
        execution_id=artifact.execution_id,
        name=artifact.name,
        media_type=artifact.media_type,
        sha256=artifact.sha256,
        size_bytes=artifact.size_bytes,
        row_count=artifact.row_count,
        created_at=_to_iso_utc(artifact.created_at),
    )


async def _require_execution_access(
    execution_id: UUID, user: SessionInfo, db: AsyncSession
) -> None:
    """Allow auditor+ or the execution's owner; otherwise raise.

    Raises 404 if the execution does not exist (so non-owners cannot probe
    for valid execution IDs) and 403 if it exists but is owned by someone else.
    """
    service = _get_service(db)
    try:
        execution = await service.get_execution(execution_id)
    except ExecutionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    if get_role_level(user.role) <= get_role_level(Role.AUDITOR):
        return
    if execution.triggered_by == user.username:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Cannot access artifacts for executions triggered by other users",
    )


@router.get("/{execution_id}/artifacts", response_model=ArtifactListResponse)
async def list_execution_artifacts(
    execution_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ArtifactListResponse:
    """List stored output artifacts for an execution.

    Accessible to auditor+ or the user who triggered the execution.
    """
    await _require_execution_access(execution_id, user, db)

    artifacts = await ArtifactService(db).list_artifacts(execution_id)
    return ArtifactListResponse(
        artifacts=[_artifact_to_response(a) for a in artifacts],
        total=len(artifacts),
    )


@router.get("/{execution_id}/artifacts/{artifact_id}")
async def download_execution_artifact(
    execution_id: UUID,
    artifact_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a single output artifact, verifying its checksum.

    Accessible to auditor+ or the user who triggered the execution. The blob
    is checksum-verified before streaming; a corrupted blob yields 500.
    """
    await _require_execution_access(execution_id, user, db)

    service = ArtifactService(db)
    artifact = await service.get_artifact(execution_id, artifact_id)
    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )

    store = get_artifact_store()
    try:
        stream = store.open_stream(artifact.sha256, verify=True)
    except ArtifactNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact data is missing from storage",
        )
    except ArtifactCorruptedError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Artifact data failed checksum verification",
        )

    headers = {
        "Content-Disposition": f'attachment; filename="{artifact.name}"',
        "Content-Length": str(artifact.size_bytes),
        "X-Checksum-SHA256": artifact.sha256,
    }
    return StreamingResponse(
        stream,
        media_type=artifact.media_type,
        headers=headers,
    )
