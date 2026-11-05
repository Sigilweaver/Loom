"""PostgreSQL integration tests for competing schedule dispatchers."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import func, select, update

from app.config import settings
from app.db.models import Execution, Schedule, Server
from app.domain.executions.service import ExecutionService
from app.domain.schedules.scheduler import Scheduler
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import TestSessionLocal, create_user_direct
from tests.dispatch_helpers import fake_server, make_dispatcher, real_issuer, run_all


@pytest.fixture
async def scheduled_run(setup_database, temp_storage):
    workflow = await db_helpers.make_workflow(WorkflowFileStore(settings.workflow_storage_path))
    server = await db_helpers.make_server()
    schedule = await db_helpers.make_schedule(workflow.id, target_server_id=server.id)
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, schedule.id)
        row.next_trigger_at = datetime.now(UTC) - timedelta(minutes=3)
        await db.commit()
    with patch("app.domain.schedules.scheduler.async_session_maker", TestSessionLocal):
        yield schedule


async def execution_count():
    async with TestSessionLocal() as db:
        return (await db.execute(select(func.count(Execution.id)))).scalar_one()


@pytest.mark.asyncio
async def test_competing_dispatchers_create_one_execution(scheduled_run):
    await asyncio.gather(
        Scheduler()._execute_schedule(scheduled_run.id),
        Scheduler()._execute_schedule(scheduled_run.id),
    )
    assert await execution_count() == 1
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        assert row.last_triggered_at is not None
        assert row.next_trigger_at > row.last_triggered_at
    await Scheduler()._execute_schedule(scheduled_run.id)
    assert await execution_count() == 1


@pytest.mark.asyncio
async def test_replacement_dispatcher_finds_overdue_occurrence(scheduled_run):
    await Scheduler()._load_schedules()
    assert await execution_count() == 1


@pytest.mark.asyncio
async def test_dispatcher_reads_current_target_from_database(scheduled_run):
    replacement = await db_helpers.make_server("replacement")
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        row.target_server_id = replacement.id
        await db.commit()
    await Scheduler()._load_schedules()
    async with TestSessionLocal() as db:
        execution = (await db.execute(select(Execution))).scalar_one()
        assert execution.server_id == replacement.id


@pytest.mark.asyncio
async def test_disabled_schedule_does_not_fire(scheduled_run):
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        row.enabled = False
        await db.commit()
    await Scheduler()._execute_schedule(scheduled_run.id)
    assert await execution_count() == 0


@pytest.mark.asyncio
async def test_uncommitted_claim_is_retried(scheduled_run):
    with patch.object(
        ExecutionService, "trigger_execution", side_effect=RuntimeError("unavailable")
    ):
        await Scheduler()._execute_schedule(scheduled_run.id)
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        assert row.last_triggered_at is None
        assert row.next_trigger_at < datetime.now(UTC)
    await Scheduler()._execute_schedule(scheduled_run.id)
    assert await execution_count() == 1


@pytest.mark.asyncio
async def test_legacy_schedule_initialized_without_immediate_execution(scheduled_run):
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        row.next_trigger_at = None
        await db.commit()
    await Scheduler()._load_schedules()
    assert await execution_count() == 0
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        assert row.next_trigger_at > datetime.now(UTC)


@pytest.mark.asyncio
async def test_locked_occurrence_is_available_after_rollback(scheduled_run):
    async with TestSessionLocal() as claimant:
        await claimant.execute(
            select(Schedule).where(Schedule.id == scheduled_run.id).with_for_update()
        )
        await Scheduler()._load_schedules()
        assert await execution_count() == 0
        # A process that exits before committing releases the claim.
        await claimant.rollback()
    await Scheduler()._load_schedules()
    assert await execution_count() == 1


@pytest.mark.asyncio
async def test_legacy_schedule_honors_future_start(scheduled_run):
    start = datetime.now(UTC) + timedelta(days=1)
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        row.start_at = start
        row.next_trigger_at = None
        await db.commit()
    await Scheduler()._load_schedules()
    assert await execution_count() == 0
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        assert row.next_trigger_at >= start


@pytest.mark.asyncio
async def test_competing_replicas_run_an_occurrence_once(scheduled_run):
    """Two Hub processes, each with a scheduler and a dispatcher."""
    await create_user_direct("test", "user")
    with real_issuer(), fake_server() as server:
        await asyncio.gather(
            Scheduler()._load_schedules(),
            Scheduler()._load_schedules(),
        )
        hub_a, hub_b = make_dispatcher("hub-a"), make_dispatcher("hub-b")
        await asyncio.gather(run_all(hub_a), run_all(hub_b))
        assert server.requests == 1
    async with TestSessionLocal() as db:
        execution = (await db.execute(select(Execution))).scalar_one()
        schedule = await db.get(Schedule, scheduled_run.id)
    assert execution.status == "completed"
    assert execution.scheduled_for is not None
    assert execution.scheduled_for < schedule.next_trigger_at


@pytest.mark.asyncio
async def test_occurrence_with_an_execution_is_skipped(scheduled_run):
    """The unique occurrence key stops a rewound schedule from running twice."""
    async with TestSessionLocal() as db:
        schedule = await db.get(Schedule, scheduled_run.id)
        occurrence = schedule.next_trigger_at
        server_id = schedule.target_server_id
    await db_helpers.make_execution(
        scheduled_run.workflow_id,
        server_id,
        trigger_type="scheduled",
        schedule_id=scheduled_run.id,
    )
    async with TestSessionLocal() as db:
        row = (await db.execute(select(Execution))).scalar_one()
        row.scheduled_for = occurrence
        await db.commit()

    with patch("app.domain.schedules.scheduler.async_session_maker", TestSessionLocal):
        await Scheduler()._execute_schedule(scheduled_run.id)
    assert await execution_count() == 1
    async with TestSessionLocal() as db:
        schedule = await db.get(Schedule, scheduled_run.id)
    assert schedule.next_trigger_at > datetime.now(UTC)


@pytest.mark.asyncio
async def test_unstartable_occurrence_logs_once_and_stays_due(scheduled_run, caplog):
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, scheduled_run.id)
        row.target_server_id = None
        await db.commit()
    async with TestSessionLocal() as db:
        await db.execute(update(Server).values(status="offline"))
        await db.commit()

    scheduler = Scheduler()
    with caplog.at_level(logging.WARNING, logger="app.domain.schedules.scheduler"):
        for _ in range(3):
            await scheduler._execute_schedule(scheduled_run.id)
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1
    assert "cannot start yet" in warnings[0].getMessage()
    assert await execution_count() == 0

    # Once a Server is online the same occurrence runs.
    async with TestSessionLocal() as db:
        await db.execute(update(Server).values(status="online"))
        await db.commit()
    await scheduler._execute_schedule(scheduled_run.id)
    assert await execution_count() == 1
