"""Execution service for workflow execution management.

Orchestrates triggering workflow executions on servers, tracking status,
and managing execution history.
"""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Server, Workflow
from app.domain.executions.models import (
    ExecutionInfo,
    ExecutionStatus,
    TriggerExecutionInput,
    TriggerType,
)
from app.domain.servers.client import ServerClient, ServerError
from app.domain.workflows.store import WorkflowFileStore

logger = logging.getLogger(__name__)


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
        # Track server round-robin index
        self._server_index = 0

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
            result = await self.db.execute(
                select(Server).where(Server.id == server_id)
            )
            server = result.scalar_one_or_none()
            if not server:
                raise ServerNotFoundError(f"Server not found: {server_id}")
            return server

        # Auto-select: get all online servers
        result = await self.db.execute(
            select(Server).where(Server.status == "online").order_by(Server.name)
        )
        servers = list(result.scalars().all())

        if not servers:
            raise NoAvailableServerError("No healthy servers available")

        # Round-robin selection
        server = servers[self._server_index % len(servers)]
        self._server_index += 1

        return server

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
        # Build query
        query = select(Execution).order_by(Execution.queued_at.desc())

        if workflow_id:
            query = query.where(Execution.workflow_id == workflow_id)
        if server_id:
            query = query.where(Execution.server_id == server_id)
        if status:
            query = query.where(Execution.status == status)
        if triggered_by:
            query = query.where(Execution.triggered_by == triggered_by)

        # Get total count (before pagination)
        count_result = await self.db.execute(
            select(Execution.id).where(
                *[c for c in query.whereclause.clauses] if query.whereclause else []
            )
        )
        total = len(count_result.all())

        # Apply pagination
        query = query.offset(offset).limit(limit)

        result = await self.db.execute(query)
        executions = result.scalars().all()

        # Resolve workflow and server names
        infos = []
        for execution in executions:
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

            infos.append(self._model_to_info(execution, workflow_name, server_name))

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
    ) -> ExecutionInfo:
        """Trigger a workflow execution.

        Creates an execution record, then runs the workflow on a server
        in the background. The execution starts in "queued" status.

        Args:
            input: Execution trigger input.
            triggered_by: Username who triggered.
            trigger_type: How the execution was triggered.
            schedule_id: Associated schedule ID if triggered by schedule.

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
            status=ExecutionStatus.QUEUED.value,
        )
        self.db.add(execution)
        await self.db.flush()

        # Commit to ensure execution is visible
        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(
            "Created execution %s for workflow %s on server %s",
            execution.id,
            workflow.name,
            server.name,
        )

        # Start async execution (fire and forget)
        asyncio.create_task(
            self._run_execution(execution.id, workflow.id, server)
        )

        return self._model_to_info(execution, workflow.name, server.name)

    async def _run_execution(
        self,
        execution_id: UUID,
        workflow_id: UUID,
        server: Server,
    ) -> None:
        """Run execution on server (background task).

        Updates execution status as it progresses.
        """
        from app.db.database import async_session_maker
        from app.domain.capabilities import get_issuer

        async with async_session_maker() as db:
            try:
                # Load workflow file
                try:
                    workflow_content = self.file_store.load(workflow_id)
                except Exception as e:
                    await self._fail_execution(
                        db, execution_id, f"Failed to load workflow: {e}"
                    )
                    return

                # Parse workflow JSON for token generation
                import json
                try:
                    workflow_json = json.loads(workflow_content.decode("utf-8"))
                except json.JSONDecodeError as e:
                    await self._fail_execution(
                        db, execution_id, f"Invalid workflow JSON: {e}"
                    )
                    return

                # Generate execution token for the server
                try:
                    issuer = get_issuer()
                    server_token = await issuer.issue_execute_token(
                        user_id="hub-system",  # Hub-triggered executions use system user
                        server=server,
                        workflow_json=workflow_json,
                    )
                    auth_token = server_token.token
                except Exception as e:
                    logger.warning(
                        "Failed to issue execution token, using server auth_token: %s", e
                    )
                    auth_token = server.auth_token

                # Update to running
                result = await db.execute(
                    select(Execution).where(Execution.id == execution_id)
                )
                execution = result.scalar_one_or_none()
                if not execution:
                    logger.error("Execution %s not found", execution_id)
                    return

                execution.status = ExecutionStatus.RUNNING.value
                execution.started_at = datetime.now(UTC)
                await db.commit()

                # Execute on server with the issued token
                client = ServerClient(server.endpoint_url, auth_token)
                exec_result = await client.execute(workflow_content)

                # Update with result
                result = await db.execute(
                    select(Execution).where(Execution.id == execution_id)
                )
                execution = result.scalar_one_or_none()
                if not execution:
                    return

                now = datetime.now(UTC)
                execution.completed_at = now

                if isinstance(exec_result, ServerError):
                    execution.status = ExecutionStatus.FAILED.value
                    execution.success = False
                    execution.error_message = exec_result.message
                else:
                    execution.status = ExecutionStatus.COMPLETED.value
                    execution.success = True
                    # Duration from server response or calculate
                    if isinstance(exec_result, dict) and "duration" in exec_result:
                        execution.duration_seconds = exec_result["duration"]
                    elif execution.started_at:
                        execution.duration_seconds = (
                            now - execution.started_at
                        ).total_seconds()

                await db.commit()

                logger.info(
                    "Execution %s %s",
                    execution_id,
                    "completed" if execution.success else "failed",
                )

            except Exception as e:
                logger.exception("Error running execution %s: %s", execution_id, e)
                await self._fail_execution(db, execution_id, str(e))

    async def _fail_execution(
        self,
        db: AsyncSession,
        execution_id: UUID,
        error_message: str,
    ) -> None:
        """Mark an execution as failed."""
        result = await db.execute(
            select(Execution).where(Execution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        if execution:
            execution.status = ExecutionStatus.FAILED.value
            execution.success = False
            execution.error_message = error_message
            execution.completed_at = datetime.now(UTC)
            await db.commit()

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
            select(Execution).where(Execution.id == execution_id)
        )
        execution = result.scalar_one_or_none()

        if not execution:
            raise ExecutionNotFoundError(f"Execution not found: {execution_id}")

        if execution.status not in (
            ExecutionStatus.QUEUED.value,
            ExecutionStatus.RUNNING.value,
        ):
            raise ExecutionServiceError(
                f"Cannot cancel execution in status: {execution.status}"
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

        logger.info("Cancelled execution %s", execution_id)
        return self._model_to_info(execution, workflow_name, server_name)
