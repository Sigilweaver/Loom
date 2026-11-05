"""Durable execution dispatch: restarts, competing replicas, leases, shutdown.

Each dispatcher instance simulates one Hub process (see tests/dispatch_helpers).
"""

import asyncio
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.models import Execution
from app.domain.executions import dispatcher as dispatcher_module
from app.domain.executions.dispatcher import INTERRUPTED_MESSAGE, not_started_message
from app.domain.executions.models import TriggerExecutionInput
from app.domain.executions.service import ExecutionService
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import _DB_URL_PREFIX, TestSessionLocal, admin_engine, create_user_direct
from tests.dispatch_helpers import fake_server, make_dispatcher, real_issuer, run_all, wait_for


@pytest.fixture
async def env(setup_database, temp_storage):
    await create_user_direct("runner", "user")
    with real_issuer(), fake_server() as server:
        yield server


async def _queued(count: int = 1, **kwargs):
    store = WorkflowFileStore(settings.workflow_storage_path)
    workflow = await db_helpers.make_workflow(store)
    server = await db_helpers.make_server()
    return [
        await db_helpers.make_execution(
            workflow.id, server.id, triggered_by="runner", **kwargs
        )
        for _ in range(count)
    ]


async def _age_lease(execution_id, seconds: int = 3600) -> None:
    async with TestSessionLocal() as db:
        row = await db.get(Execution, execution_id)
        assert row is not None
        row.heartbeat_at = datetime.now(UTC) - timedelta(seconds=seconds)
        await db.commit()


async def _status(execution_id) -> str:
    return (await db_helpers.reload_execution(execution_id)).status


class TestRestart:
    async def test_queued_execution_survives_restart(self, env):
        """Work queued by a Hub that then died is run by the next Hub."""
        store = WorkflowFileStore(settings.workflow_storage_path)
        workflow = await db_helpers.make_workflow(store)
        await db_helpers.make_server()
        async with TestSessionLocal() as db:
            info = await ExecutionService(db).trigger_execution(
                TriggerExecutionInput(workflow_id=workflow.id), triggered_by="runner"
            )
        # No dispatcher was running: the triggering process is gone.
        assert await _status(info.id) == "queued"

        restarted = make_dispatcher("hub-restarted")
        assert await run_all(restarted) == 1

        row = await db_helpers.reload_execution(info.id)
        assert row.status == "completed"
        assert row.claimed_by == "hub-restarted"
        assert row.attempts == 1
        assert env.requests == 1

    async def test_unclaimed_queued_rows_are_never_swept(self, env):
        [old] = await _queued(queued_at=datetime.now(UTC) - timedelta(days=2))
        assert await make_dispatcher().sweep() == 0
        assert await _status(old.id) == "queued"

    async def test_preparing_claim_lost_by_crash_is_reclaimed(self, env):
        [execution] = await _queued()
        crashed = make_dispatcher("hub-a")
        [stale_claim] = await crashed.claim(1)
        # hub-a dies before sending anything; its lease runs out.
        await _age_lease(execution.id)

        survivor = make_dispatcher("hub-b")
        [claim] = await survivor.claim(1)
        assert claim.attempt == 2
        assert claim.token != stale_claim.token

        # If hub-a was only partitioned, its late attempt is fenced out.
        await crashed.run_claim(stale_claim)
        assert env.requests == 0
        assert await _status(execution.id) == "queued"

        await survivor.run_claim(claim)
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "completed"
        assert row.claimed_by == "hub-b"
        assert env.requests == 1

    async def test_lease_lost_while_preparing_is_fenced(self, env):
        """A claim lost after the runner loaded the row cannot start it."""
        [execution] = await _queued()
        hub_a, hub_b = make_dispatcher("hub-a"), make_dispatcher("hub-b")
        [claim_a] = await hub_a.claim(1)
        taken_over: list = []
        from app.domain.capabilities import get_issuer

        real = get_issuer()

        class StallingIssuer:
            async def issue_token(self, **kwargs):
                # While hub-a prepares, its lease expires and hub-b claims.
                if not taken_over:
                    await _age_lease(execution.id)
                    taken_over.extend(await hub_b.claim(1))
                return await real.issue_token(**kwargs)

        with patch("app.domain.capabilities.get_issuer", lambda: StallingIssuer()):
            await hub_a.run_claim(claim_a)
        assert len(taken_over) == 1
        assert env.requests == 0
        assert await _status(execution.id) == "queued"

        await hub_b.run_claim(taken_over[0])
        assert env.requests == 1
        assert (await db_helpers.reload_execution(execution.id)).claimed_by == "hub-b"

    async def test_claims_are_capped_then_failed_by_sweep(self, env):
        [execution] = await _queued()
        for name in ("a", "b", "c"):
            assert len(await make_dispatcher(name).claim(1)) == 1
            await _age_lease(execution.id)
        assert settings.execution_max_attempts == 3

        assert await make_dispatcher("d").claim(1) == []
        assert await make_dispatcher("d").sweep() == 1
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.error_message == not_started_message(3)
        assert env.requests == 0

    async def test_running_execution_of_dead_hub_is_failed_not_retried(self, env):
        [execution] = await _queued()
        env.gate = asyncio.Event()
        hub_a = make_dispatcher("hub-a")
        [claim] = await hub_a.claim(1)
        runner = asyncio.create_task(hub_a.run_claim(claim))
        await wait_for(lambda: _is(execution.id, "running"))

        # hub-a stops heartbeating (it is partitioned or hung).
        await _age_lease(execution.id)
        hub_b = make_dispatcher("hub-b")
        assert await hub_b.sweep() == 1
        assert await hub_b.claim(1) == []

        # hub-a's late answer must not overwrite the recovered state.
        env.gate.set()
        await runner
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.error_message == INTERRUPTED_MESSAGE
        assert env.requests == 1

    async def test_legacy_running_row_without_lease_is_swept(self, env):
        [execution] = await _queued(status="running")
        async with TestSessionLocal() as db:
            row = await db.get(Execution, execution.id)
            row.started_at = datetime.now(UTC) - timedelta(hours=1)
            row.queued_at = row.started_at
            await db.commit()
        assert await make_dispatcher().sweep() == 1
        assert (await db_helpers.reload_execution(execution.id)).error_message == (
            INTERRUPTED_MESSAGE
        )


async def _is(execution_id, status: str) -> bool:
    return await _status(execution_id) == status


class TestCompetingReplicas:
    async def test_concurrent_claims_are_disjoint(self, env):
        executions = await _queued(20)
        a, b = make_dispatcher("hub-a"), make_dispatcher("hub-b")
        claims_a, claims_b = await asyncio.gather(a.claim(20), b.claim(20))
        ids_a = {c.execution_id for c in claims_a}
        ids_b = {c.execution_id for c in claims_b}
        assert ids_a.isdisjoint(ids_b)
        assert ids_a | ids_b == {e.id for e in executions}

    async def test_each_execution_runs_exactly_once(self, env):
        executions = await _queued(24)
        replicas = [make_dispatcher(f"hub-{i}", max_concurrent=4) for i in range(3)]
        await asyncio.gather(*(r.start() for r in replicas))

        async def all_done() -> bool:
            async with TestSessionLocal() as db:
                statuses = (await db.execute(select(Execution.status))).scalars().all()
            return all(s == "completed" for s in statuses)

        try:
            await wait_for(all_done, timeout=15)
        finally:
            await asyncio.gather(*(r.stop(grace_seconds=1) for r in replicas))
        assert env.requests == len(executions)
        async with TestSessionLocal() as db:
            rows = (await db.execute(select(Execution))).scalars().all()
        assert all(r.attempts == 1 for r in rows)
        assert len({r.claimed_by for r in rows}) >= 2

    async def test_max_concurrent_limits_claims(self, env):
        await _queued(5)
        env.gate = asyncio.Event()
        hub = make_dispatcher(max_concurrent=2)
        assert len(await hub.dispatch_once()) == 2
        assert await hub.dispatch_once() == []
        assert hub.active_count == 2
        env.gate.set()
        await hub.wait_idle()
        assert await run_all(hub) == 3


class TestCancellation:
    async def test_cancel_is_seen_by_the_runner(self, env):
        [execution] = await _queued()
        env.gate = asyncio.Event()  # the Server never answers
        hub = make_dispatcher()
        with patch.object(dispatcher_module, "HEARTBEAT_INTERVAL_SECONDS", 0.05):
            [claim] = await hub.claim(1)
            runner = asyncio.create_task(hub.run_claim(claim))
            await wait_for(lambda: _is(execution.id, "running"))
            async with TestSessionLocal() as db:
                await ExecutionService(db).cancel_execution(execution.id)
            await asyncio.wait_for(runner, timeout=5)
        assert env.cancelled == 1
        assert await _status(execution.id) == "cancelled"

    async def test_cancelled_queued_execution_is_never_claimed(self, env):
        [execution] = await _queued()
        async with TestSessionLocal() as db:
            await ExecutionService(db).cancel_execution(execution.id)
        assert await make_dispatcher().claim(5) == []
        assert env.requests == 0


class TestShutdown:
    async def test_preparing_run_is_released_to_other_hubs(self, env):
        [execution] = await _queued()
        blocked = asyncio.Event()

        class SlowIssuer:
            async def issue_token(self, **kwargs):
                blocked.set()
                await asyncio.Event().wait()

        hub = make_dispatcher("hub-a")
        with patch("app.domain.capabilities.get_issuer", lambda: SlowIssuer()):
            await hub.dispatch_once()
            await asyncio.wait_for(blocked.wait(), timeout=5)
            await hub.stop(grace_seconds=5)

        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "queued"
        assert row.claim_token is None
        assert row.attempts == 0
        # Another Hub picks it up straight away, without waiting for a lease.
        assert await run_all(make_dispatcher("hub-b")) == 1
        assert await _status(execution.id) == "completed"

    async def test_running_run_finishing_within_grace_completes(self, env):
        [execution] = await _queued()
        env.gate = asyncio.Event()
        hub = make_dispatcher()
        await hub.dispatch_once()
        await wait_for(lambda: _is(execution.id, "running"))
        asyncio.get_running_loop().call_later(0.1, env.gate.set)
        await hub.stop(grace_seconds=5)
        assert await _status(execution.id) == "completed"

    async def test_running_run_past_grace_is_marked_interrupted(self, env):
        [execution] = await _queued()
        env.gate = asyncio.Event()
        hub = make_dispatcher()
        await hub.dispatch_once()
        await wait_for(lambda: _is(execution.id, "running"))
        await hub.stop(grace_seconds=0.1)
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.error_message == INTERRUPTED_MESSAGE
        assert env.cancelled == 1

    async def test_trigger_wakes_running_dispatcher(self, env):
        store = WorkflowFileStore(settings.workflow_storage_path)
        workflow = await db_helpers.make_workflow(store)
        await db_helpers.make_server()
        hub = make_dispatcher()
        with (
            patch.object(dispatcher_module, "POLL_INTERVAL_SECONDS", 60),
            patch.object(dispatcher_module, "_dispatcher", hub),
        ):
            await hub.start()
            try:
                await asyncio.sleep(0.05)  # the first poll found nothing
                async with TestSessionLocal() as db:
                    info = await ExecutionService(db).trigger_execution(
                        TriggerExecutionInput(workflow_id=workflow.id),
                        triggered_by="runner",
                    )
                await wait_for(lambda: _is(info.id, "completed"), timeout=3)
            finally:
                await hub.stop()


class TestMigration:
    async def test_010_upgrades_from_009(self):
        backend_dir = Path(__file__).resolve().parent.parent.parent
        db_name = "sigilweaver_loom_hub_migtest010"
        url = f"{_DB_URL_PREFIX}/{db_name}"

        async with admin_engine.connect() as conn:
            await conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
            await conn.execute(text(f"CREATE DATABASE {db_name}"))

        def alembic(*args: str) -> None:
            subprocess.run(
                [sys.executable, "-m", "alembic", *args],
                cwd=backend_dir,
                env={**os.environ, "DATABASE_URL": url},
                check=True,
                capture_output=True,
            )

        engine = create_async_engine(url, poolclass=NullPool)
        try:
            await asyncio.to_thread(alembic, "upgrade", "009")
            await asyncio.to_thread(alembic, "upgrade", "010")
            async with engine.connect() as conn:
                columns = dict(
                    (
                        await conn.execute(
                            text(
                                "SELECT column_name, is_nullable FROM "
                                "information_schema.columns WHERE table_name = "
                                "'executions' AND column_name IN ('claim_token', "
                                "'claimed_by', 'attempts', 'scheduled_for')"
                            )
                        )
                    ).all()
                )
                indexes = set(
                    (
                        await conn.execute(
                            text(
                                "SELECT indexname FROM pg_indexes "
                                "WHERE tablename = 'executions'"
                            )
                        )
                    ).scalars()
                )
            assert columns == {
                "claim_token": "YES",
                "claimed_by": "YES",
                "attempts": "NO",
                "scheduled_for": "YES",
            }
            assert {"uq_executions_schedule_occurrence", "ix_executions_active"} <= indexes
            await asyncio.to_thread(alembic, "downgrade", "009")
        finally:
            await engine.dispose()
            async with admin_engine.connect() as conn:
                await conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
