"""Tests for execution durability: stale sweep and the 009 migration."""

import asyncio
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.models import Execution
from app.domain.executions.service import INTERRUPTED_MESSAGE, sweep_stale_executions
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import _DB_URL_PREFIX, TestSessionLocal, admin_engine


async def _make(status: str, *, age_seconds: int, heartbeat_age: int | None = None):
    store = WorkflowFileStore(settings.workflow_storage_path)
    workflow = await db_helpers.make_workflow(store)
    server = await db_helpers.make_server()
    execution = await db_helpers.make_execution(
        workflow.id,
        server.id,
        status=status,
        queued_at=datetime.now(UTC) - timedelta(seconds=age_seconds),
    )
    if heartbeat_age is not None:
        async with TestSessionLocal() as db:
            row = await db.get(Execution, execution.id)
            assert row is not None
            row.heartbeat_at = datetime.now(UTC) - timedelta(seconds=heartbeat_age)
            await db.commit()
    return execution


class TestSweep:
    @pytest.mark.asyncio
    async def test_stale_executions_are_failed(self, setup_database, temp_storage):
        stale = await _make("running", age_seconds=3600, heartbeat_age=3000)
        queued = await _make("queued", age_seconds=3600)

        with patch("app.db.database.async_session_maker", TestSessionLocal):
            assert await sweep_stale_executions() == 2

        for execution in (stale, queued):
            row = await db_helpers.reload_execution(execution.id)
            assert row.status == "failed"
            assert row.success is False
            assert row.error_message == INTERRUPTED_MESSAGE
            assert row.completed_at is not None

    @pytest.mark.asyncio
    async def test_fresh_executions_are_untouched(self, setup_database, temp_storage):
        # Old start but a recent heartbeat, a just-queued run, a finished run.
        beating = await _make("running", age_seconds=3600, heartbeat_age=5)
        fresh = await _make("queued", age_seconds=1)
        done = await _make("completed", age_seconds=3600)

        with patch("app.db.database.async_session_maker", TestSessionLocal):
            assert await sweep_stale_executions() == 0

        assert (await db_helpers.reload_execution(beating.id)).status == "running"
        assert (await db_helpers.reload_execution(fresh.id)).status == "queued"
        assert (await db_helpers.reload_execution(done.id)).status == "completed"


class TestMigration:
    @pytest.mark.asyncio
    async def test_009_upgrades_from_008(self):
        backend_dir = Path(__file__).resolve().parent.parent.parent
        db_name = "sigilweaver_loom_hub_migtest009"
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
            await asyncio.to_thread(alembic, "upgrade", "008")
            await asyncio.to_thread(alembic, "upgrade", "009")
            async with engine.connect() as conn:
                nullable = (
                    await conn.execute(
                        text(
                            "SELECT is_nullable FROM information_schema.columns "
                            "WHERE table_name = 'executions' "
                            "AND column_name = 'heartbeat_at'"
                        )
                    )
                ).scalars().all()
            assert list(nullable) == ["YES"]
            await asyncio.to_thread(alembic, "downgrade", "008")
        finally:
            await engine.dispose()
            async with admin_engine.connect() as conn:
                await conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
