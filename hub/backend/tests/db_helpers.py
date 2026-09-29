"""Direct-to-database row builders for domain-level tests.

These bypass the HTTP layer so tests of services and background tasks can set
up exactly the rows they need.
"""

import uuid
from datetime import UTC, datetime
from uuid import UUID

from app.db.models import Execution, Schedule, Server, Workflow
from app.domain.workflows.store import WorkflowFileStore
from tests.conftest import TestSessionLocal, make_workflow_content


async def make_server(
    name: str = "srv",
    *,
    status: str = "online",
    auth_token: str | None = "per-server-secret",
) -> Server:
    """Insert a server row."""
    async with TestSessionLocal() as db:
        server = Server(
            name=name,
            endpoint_url=f"http://{name}.invalid:25811",
            auth_token=auth_token,
            status=status,
            created_by="test",
        )
        db.add(server)
        await db.commit()
        return server


async def make_workflow(store: WorkflowFileStore, name: str = "wf") -> Workflow:
    """Insert a workflow row and write its file into ``store``."""
    workflow_id = uuid.uuid4()
    content = make_workflow_content(name=name)
    checksum = store.save(workflow_id, content)
    async with TestSessionLocal() as db:
        workflow = Workflow(
            id=workflow_id,
            name=name,
            workflow_id=str(uuid.uuid4()),
            file_path=f"{workflow_id}.swwf",
            checksum=checksum,
            uploaded_by="test",
        )
        db.add(workflow)
        await db.commit()
        return workflow


async def make_schedule(
    workflow_id: UUID,
    *,
    created_by: str | None = "test",
    cron_expression: str = "* * * * *",
    enabled: bool = True,
    target_server_id: UUID | None = None,
) -> Schedule:
    """Insert a schedule row."""
    async with TestSessionLocal() as db:
        schedule = Schedule(
            workflow_id=workflow_id,
            cron_expression=cron_expression,
            timezone="UTC",
            enabled=enabled,
            created_by=created_by,
            target_server_id=target_server_id,
        )
        db.add(schedule)
        await db.commit()
        return schedule


async def make_execution(
    workflow_id: UUID,
    server_id: UUID,
    *,
    status: str = "queued",
    trigger_type: str = "manual",
    triggered_by: str | None = "testuser",
    schedule_id: UUID | None = None,
    queued_at: datetime | None = None,
) -> Execution:
    """Insert an execution row."""
    async with TestSessionLocal() as db:
        execution = Execution(
            workflow_id=workflow_id,
            server_id=server_id,
            trigger_type=trigger_type,
            triggered_by=triggered_by,
            schedule_id=schedule_id,
            status=status,
            queued_at=queued_at or datetime.now(UTC),
        )
        db.add(execution)
        await db.commit()
        return execution


async def reload_execution(execution_id: UUID) -> Execution:
    """Fetch a fresh copy of an execution row."""
    async with TestSessionLocal() as db:
        execution = await db.get(Execution, execution_id)
        assert execution is not None
        return execution
