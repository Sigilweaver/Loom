"""Execution service for workflow execution management.

Orchestrates triggering workflow executions on servers, tracking status,
and managing execution history.
"""

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Schedule, Server, User, Workflow
from app.domain.executions.broker import execution_broker
from app.domain.executions.models import (
    ExecutionInfo,
    ExecutionStatus,
    TriggerExecutionInput,
    TriggerType,
)
from app.domain.servers.selection import NoOnlineServerError, select_online_server
from app.domain.workflows.store import WorkflowFileStore

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = (ExecutionStatus.QUEUED.value, ExecutionStatus.RUNNING.value)


async def publish_executions(db: AsyncSession, execution_ids: Sequence[UUID]) -> None:
    """Publish the current state of executions to this process's live broker.

    Best-effort: a lookup or serialization failure must never disrupt the
    execution lifecycle, so it is logged and the lifecycle carries on.
    """
    if not execution_ids:
        return
    try:
        rows = (
            await db.execute(
                select(Execution, Workflow.name, Server.name)
                .outerjoin(Workflow, Workflow.id == Execution.workflow_id)
                .outerjoin(Server, Server.id == Execution.server_id)
                .where(Execution.id.in_(list(execution_ids)))
                .execution_options(populate_existing=True)
            )
        ).all()
        service = ExecutionService(db)
        for execution, workflow_name, server_name in rows:
            info = service._model_to_info(
                execution, workflow_name or "Unknown", server_name or "Unknown"
            )
            execution_broker.publish(service._info_to_event(info, execution))
    except Exception:
        logger.warning(
            "Failed to publish execution events for %s",
            ", ".join(str(i) for i in execution_ids),
            exc_info=True,
        )


class ExecutionServiceError(Exception):
    """Base exception for execution service errors."""

    pass


class ExecutionNotFoundError(ExecutionServiceError):
    """Raised when an execution doesn't exist."""

    pass


class NoAvailableServerError(ExecutionServiceError):
    """Raised when no healthy server is available for execution."""

    pass


class WorkflowNotFoundError(ExecutionServiceError):
    """Raised when the workflow doesn't exist."""

    pass


class ServerNotFoundError(ExecutionServiceError):
    """Raised when the specified server doesn't exist."""

    pass


class ExecutionService:
    """Service for managing workflow executions.

    Handles triggering executions on servers, tracking status,
    and querying execution history.
    """

    def __init__(
        self,
        db: AsyncSession,
        file_store: WorkflowFileStore | None = None,
    ):
        """Initialize the execution service.

        Args:
            db: Async database session.
            file_store: File store for workflow files.
        """
        self.db = db
        self.file_store = file_store or WorkflowFileStore()

    def _model_to_info(
        self,
        execution: Execution,
        workflow_name: str,
        server_name: str,
    ) -> ExecutionInfo:
        """Convert database model to ExecutionInfo."""
        return ExecutionInfo(
            id=execution.id,
            workflow_id=execution.workflow_id,
            workflow_name=workflow_name,
            server_id=execution.server_id,
            server_name=server_name,
            trigger_type=TriggerType(execution.trigger_type),
            triggered_by=execution.triggered_by,
            schedule_id=execution.schedule_id,
            status=ExecutionStatus(execution.status),
            queued_at=execution.queued_at,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            success=execution.success,
            error_message=execution.error_message,
            duration_seconds=execution.duration_seconds,
        )

    async def _publish_execution_event(
        self,
        execution: Execution,
        workflow_name: str,
        server_name: str,
    ) -> None:
        """Publish the current execution state to the live event broker.

        Best-effort: a broker/serialization failure must never disrupt the
        execution lifecycle, so errors are logged and swallowed.
        """
        try:
            info = self._model_to_info(execution, workflow_name, server_name)
            execution_broker.publish(self._info_to_event(info, execution))
        except Exception as e:  # pragma: no cover - defensive, broker is in-proc
            logger.warning(
                "Failed to publish execution event for %s: %s", execution.id, e
            )

    @staticmethod
    def _iso_utc(dt: datetime | None) -> str | None:
        """Serialize a datetime as ISO-8601 with an explicit UTC offset.

        Mirrors the REST response formatting so live events and polled
        responses share an identical timestamp representation (naive
        timestamps are assumed to be UTC).
        """
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.isoformat()

    def _info_to_event(
        self, info: ExecutionInfo, execution: Execution
    ) -> dict[str, Any]:
        """Build a JSON-serializable SSE payload for an execution."""
        event = info.model_dump(mode="json")
        event["queued_at"] = self._iso_utc(execution.queued_at)
        event["started_at"] = self._iso_utc(execution.started_at)
        event["completed_at"] = self._iso_utc(execution.completed_at)
        return event

    async def _select_server(self, server_id: UUID | None = None) -> Server:
        """Select a server for execution.

        Args:
            server_id: Specific server to use, or None for auto-select.

        Returns:
            Selected Server.

        Raises:
            ServerNotFoundError: If specified server doesn't exist.
            NoAvailableServerError: If no healthy server is available.
        """
        if server_id:
            result = await self.db.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
            if not server:
                raise ServerNotFoundError(f"Server not found: {server_id}")
            return server

        # Auto-select: least-loaded online server (ties broken at random).
        try:
            return await select_online_server(self.db)
        except NoOnlineServerError:
            raise NoAvailableServerError("No healthy servers available") from None

    async def list_executions(
        self,
        workflow_id: UUID | None = None,
        server_id: UUID | None = None,
        status: str | None = None,
        triggered_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ExecutionInfo], int]:
        """List executions with optional filtering.

        Args:
            workflow_id: Filter by workflow.
            server_id: Filter by server.
            status: Filter by status.
            triggered_by: Filter by triggering username.
            limit: Maximum results.
            offset: Pagination offset.

        Returns:
            Tuple of (list of ExecutionInfo, total count).
        """
        filters = []

        if workflow_id:
            filters.append(Execution.workflow_id == workflow_id)
        if server_id:
            filters.append(Execution.server_id == server_id)
        if status:
            filters.append(Execution.status == status)
        if triggered_by:
            filters.append(Execution.triggered_by == triggered_by)

        # Get total count (before pagination)
        count_result = await self.db.execute(
            select(func.count()).select_from(Execution).where(*filters)
        )
        total = count_result.scalar_one()

        # Apply pagination
        query = (
            select(Execution, Workflow.name, Server.name)
            .outerjoin(Workflow, Workflow.id == Execution.workflow_id)
            .outerjoin(Server, Server.id == Execution.server_id)
            .where(*filters)
            .order_by(Execution.queued_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(query)
        rows = result.all()

        infos = [
            self._model_to_info(
                execution,
                workflow_name or "Unknown",
                server_name or "Unknown",
            )
            for execution, workflow_name, server_name in rows
        ]

        return infos, total

    async def get_execution(self, execution_id: UUID) -> ExecutionInfo:
        """Get execution by ID.

        Args:
            execution_id: Execution UUID.

        Returns:
            ExecutionInfo.

        Raises:
            ExecutionNotFoundError: If execution doesn't exist.
        """
        result = await self.db.execute(
            select(Execution).where(Execution.id == execution_id)
        )
        execution = result.scalar_one_or_none()

        if not execution:
            raise ExecutionNotFoundError(f"Execution not found: {execution_id}")

        # Get workflow name
        wf_result = await self.db.execute(
            select(Workflow.name).where(Workflow.id == execution.workflow_id)
        )
        workflow_name = wf_result.scalar_one_or_none() or "Unknown"

        # Get server name
        srv_result = await self.db.execute(
            select(Server.name).where(Server.id == execution.server_id)
        )
        server_name = srv_result.scalar_one_or_none() or "Unknown"

        return self._model_to_info(execution, workflow_name, server_name)

    async def trigger_execution(
        self,
        input: TriggerExecutionInput,
        triggered_by: str,
        trigger_type: TriggerType = TriggerType.MANUAL,
        schedule_id: UUID | None = None,
        scheduled_for: datetime | None = None,
    ) -> ExecutionInfo:
        """Queue a workflow execution.

        Commits a "queued" execution record. A dispatcher on any Hub process
        claims and runs it (see ``app.domain.executions.dispatcher``).

        Args:
            input: Execution trigger input.
            triggered_by: Username who triggered.
            trigger_type: How the execution was triggered.
            schedule_id: Associated schedule ID if triggered by schedule.
            scheduled_for: The cron occurrence this run is for. Unique per
                schedule, so committing a second run for the same occurrence
                raises ``IntegrityError``.

        Returns:
            ExecutionInfo for the new execution.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
            NoAvailableServerError: If no server is available.
        """
        # Verify workflow exists
        wf_result = await self.db.execute(
            select(Workflow).where(Workflow.id == input.workflow_id)
        )
        workflow = wf_result.scalar_one_or_none()
        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {input.workflow_id}")

        # Select server
        server = await self._select_server(input.server_id)

        # Create execution record
        execution = Execution(
            workflow_id=input.workflow_id,
            server_id=server.id,
            trigger_type=trigger_type.value,
            triggered_by=triggered_by,
            schedule_id=schedule_id,
            scheduled_for=scheduled_for,
            status=ExecutionStatus.QUEUED.value,
        )
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(
            "Created execution %s for workflow %s on server %s",
            execution.id,
            workflow.name,
            server.name,
        )

        # Announce the queued execution to live subscribers.
        await self._publish_execution_event(execution, workflow.name, server.name)

        # The row is the queue entry: a dispatcher on any Hub process claims
        # it. Wake this process's dispatcher so a local trigger starts at once.
        from app.domain.executions.dispatcher import wake_dispatcher

        wake_dispatcher()

        return self._model_to_info(execution, workflow.name, server.name)

    async def resolve_run_as_user_id(self, execution_id: UUID) -> UUID | None:
        """Find the user an execution runs as.

        Manual executions run as the user who triggered them. Scheduled
        executions run as the user who created the schedule. Returns None if
        that user no longer exists.
        """
        result = await self.db.execute(
            select(Execution.trigger_type, Execution.triggered_by, Schedule.created_by)
            .outerjoin(Schedule, Schedule.id == Execution.schedule_id)
            .where(Execution.id == execution_id)
        )
        row = result.first()
        if row is None:
            return None
        trigger_type, triggered_by, schedule_creator = row
        if trigger_type == TriggerType.SCHEDULED.value:
            username = schedule_creator
        else:
            username = triggered_by
        if not username:
            return None
        user_id = await self.db.execute(select(User.id).where(User.username == username))
        found: UUID | None = user_id.scalar_one_or_none()
        return found

    async def cancel_execution(self, execution_id: UUID) -> ExecutionInfo:
        """Cancel a running or queued execution.

        Args:
            execution_id: Execution to cancel.

        Returns:
            Updated ExecutionInfo.

        Raises:
            ExecutionNotFoundError: If execution doesn't exist.
            ExecutionServiceError: If execution cannot be cancelled.
        """
        result = await self.db.execute(
            select(Execution)
            .where(Execution.id == execution_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        execution = result.scalar_one_or_none()

        if not execution:
            raise ExecutionNotFoundError(f"Execution not found: {execution_id}")

        if execution.status not in (
            ExecutionStatus.QUEUED.value,
            ExecutionStatus.RUNNING.value,
        ):
            status = execution.status
            await self.db.rollback()
            raise ExecutionServiceError(
                f"Cannot cancel execution in status: {status}"
            )

        # Mark as cancelled
        execution.status = ExecutionStatus.CANCELLED.value
        execution.completed_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(execution)

        # Get names for response
        wf_result = await self.db.execute(
            select(Workflow.name).where(Workflow.id == execution.workflow_id)
        )
        workflow_name = wf_result.scalar_one_or_none() or "Unknown"

        srv_result = await self.db.execute(
            select(Server.name).where(Server.id == execution.server_id)
        )
        server_name = srv_result.scalar_one_or_none() or "Unknown"

        info = self._model_to_info(execution, workflow_name, server_name)

        # Announce the cancelled transition.
        execution_broker.publish(self._info_to_event(info, execution))

        logger.info("Cancelled execution %s", execution_id)
        return info
