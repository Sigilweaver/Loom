"""The migrated schema matches the models, and migration 011 is safe."""

import asyncio
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.db.models import Base
from tests.conftest import _DB_URL_PREFIX, admin_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture
async def scratch_db():
    name = f"sigilweaver_loom_hub_mig_{uuid.uuid4().hex[:8]}"
    async with admin_engine.connect() as conn:
        await conn.execute(text(f"CREATE DATABASE {name}"))
    url = f"{_DB_URL_PREFIX}/{name}"
    engine = create_async_engine(url, poolclass=NullPool)

    async def alembic(*args: str) -> subprocess.CompletedProcess[str]:
        return await asyncio.to_thread(
            subprocess.run,
            [sys.executable, "-m", "alembic", *args],
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": url},
            capture_output=True,
            text=True,
        )

    try:
        yield engine, alembic
    finally:
        await engine.dispose()
        async with admin_engine.connect() as conn:
            await conn.execute(text(f"DROP DATABASE IF EXISTS {name}"))


async def test_migrations_match_models(scratch_db):
    engine, alembic = scratch_db
    assert (await alembic("upgrade", "head")).returncode == 0

    def diff(sync_conn):
        ctx = MigrationContext.configure(sync_conn, opts={"compare_type": True})
        return compare_metadata(ctx, Base.metadata)

    async with engine.connect() as conn:
        assert await conn.run_sync(diff) == []


async def test_011_backfills_model_defaults(scratch_db):
    engine, alembic = scratch_db
    assert (await alembic("upgrade", "010")).returncode == 0
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO groups (id, name, description, created_by, created_at, updated_at) "
                "VALUES (gen_random_uuid(), 'g', NULL, 'test', now(), now())"
            )
        )
    assert (await alembic("upgrade", "011")).returncode == 0
    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT description FROM groups"))).scalar() == ""
    assert (await alembic("downgrade", "010")).returncode == 0


async def test_011_refuses_to_rewrite_audit_details(scratch_db):
    engine, alembic = scratch_db
    assert (await alembic("upgrade", "010")).returncode == 0
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO audit_events (id, timestamp, event_type, actor_type, "
                "actor_identity, details, event_hash, hash_version) VALUES "
                "(gen_random_uuid(), now(), 'x', 'user', 'u', NULL, 'h', 2)"
            )
        )
    result = await alembic("upgrade", "011")
    assert result.returncode != 0
    assert "audit_events.details (1 row(s))" in result.stderr
    async with engine.connect() as conn:
        version = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar()
    assert version == "010"
