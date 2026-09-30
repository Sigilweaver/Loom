"""PostgreSQL integration tests for competing schedule dispatchers."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.db.models import Execution, Schedule
from app.domain.executions.service import ExecutionService
from app.domain.schedules.scheduler import Scheduler
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import TestSessionLocal


@pytest.fixture
async def scheduled_run(setup_database, temp_storage):
    workflow = await db_helpers.make_workflow(WorkflowFileStore(settings.workflow_storage_path))
    server = await db_helpers.make_server()
    schedule = await db_helpers.make_schedule(workflow.id, target_server_id=server.id)
    async with TestSessionLocal() as db:
        row = await db.get(Schedule, schedule.id)
        row.next_trigger_at = datetime.now(UTC) - timedelta(minutes=3)
        await db.commit()
    with (
        patch("app.domain.schedules.scheduler.async_session_maker", TestSessionLocal),
        patch.object(ExecutionService, "_run_execution"),
    ):
        yield schedule
    await asyncio.sleep(0)


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
