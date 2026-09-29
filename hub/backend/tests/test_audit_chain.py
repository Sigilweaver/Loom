"""Tests for audit hash chain verification (Loom#110)."""

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.db.models import AuditEvent
from app.domain.audit import AuditService
from tests.conftest import (
    _DB_URL_PREFIX,
    TestSessionLocal,
    admin_engine,
    new_client,
)


async def _log_events(n: int) -> list[AuditEvent]:
    events = []
    async with TestSessionLocal() as db:
        service = AuditService(db)
        for i in range(n):
            events.append(
                await service.log_event(
                    "execution.requested",
                    "user",
                    f"user{i}",
                    details={"n": i},
                    client_ip="10.0.0.1",
                )
            )
        await db.commit()
    return events


async def _verify() -> dict:
    async with TestSessionLocal() as db:
        return await AuditService(db).verify_chain()


async def _execute(sql: str, **params) -> None:
    async with TestSessionLocal() as db:
        await db.execute(text(sql), params)
        await db.commit()


@pytest.mark.usefixtures("setup_database")
class TestVerifyChain:
    async def test_clean_chain_verifies(self):
        events = await _log_events(5)

        result = await _verify()

        assert result["valid"] is True
        assert result["events_checked"] == 5
        assert result["legacy_events"] == 0
        assert "warning" not in result
        assert result["first_event_id"] == str(events[0].id)
        assert result["last_event_id"] == str(events[-1].id)
        assert all(e.hash_version == 2 for e in events)

    async def test_empty_chain_verifies(self):
        result = await _verify()

        assert result["valid"] is True
        assert result["events_checked"] == 0

    async def test_events_in_one_session_chain_correctly(self):
        """Several events in a single transaction must link to each other."""
        async with TestSessionLocal() as db:
            service = AuditService(db)
            a = await service.log_event("a", "system", "s")
            b = await service.log_event("b", "system", "s")
            await db.commit()

        assert b.previous_hash == a.event_hash
        assert (await _verify())["valid"] is True

    async def test_modified_content_is_detected(self):
        events = await _log_events(4)

        await _execute(
            "UPDATE audit_events SET actor_identity = 'mallory' WHERE id = :id",
            id=events[2].id,
        )
        result = await _verify()

        assert result["valid"] is False
        assert "Hash mismatch" in result["error"]
        assert result["last_event_id"] == str(events[2].id)

    async def test_modified_details_are_detected(self):
        events = await _log_events(3)

        await _execute(
            "UPDATE audit_events SET details = CAST('{\"n\": 99}' AS jsonb) WHERE id = :id",
            id=events[1].id,
        )

        assert (await _verify())["valid"] is False

    async def test_deleted_middle_event_is_detected(self):
        events = await _log_events(5)

        await _execute("DELETE FROM audit_events WHERE id = :id", id=events[2].id)
        result = await _verify()

        assert result["valid"] is False
        assert "Chain broken" in result["error"]
        assert result["last_event_id"] == str(events[3].id)

    async def test_deleted_event_at_window_edge_is_detected(self):
        """The event just outside the verify window anchors linkage."""
        events = await _log_events(5)

        await _execute("DELETE FROM audit_events WHERE id = :id", id=events[1].id)
        async with TestSessionLocal() as db:
            result = await AuditService(db).verify_chain(limit=3)

        assert result["valid"] is False
        assert "Chain broken" in result["error"]

    async def test_legacy_rows_are_reported_not_tampered(self):
        """Version 1 rows carry a bogus hash; they are unverifiable, not tampered."""
        legacy_id = uuid.uuid4()
        await _execute(
            "INSERT INTO audit_events (id, timestamp, event_type, actor_type, "
            "actor_identity, details, event_hash, previous_hash, hash_version) "
            "VALUES (:id, :ts, 'old', 'user', 'u', CAST('{}' AS jsonb), :h, NULL, 1)",
            id=legacy_id,
            ts=datetime(2020, 1, 1, tzinfo=UTC),
            h="f" * 64,
        )
        events = await _log_events(2)

        result = await _verify()

        assert result["valid"] is True
        assert result["events_checked"] == 3
        assert result["legacy_events"] == 1
        assert "unverifiable (legacy)" in result["warning"]
        # The first new event chains to the legacy row's stored hash.
        assert events[0].previous_hash == "f" * 64

    async def test_tampering_new_event_after_legacy_rows_is_detected(self):
        await _execute(
            "INSERT INTO audit_events (id, timestamp, event_type, actor_type, "
            "actor_identity, details, event_hash, previous_hash, hash_version) "
            "VALUES (:id, :ts, 'old', 'user', 'u', CAST('{}' AS jsonb), :h, NULL, 1)",
            id=uuid.uuid4(),
            ts=datetime(2020, 1, 1, tzinfo=UTC),
            h="f" * 64,
        )
        events = await _log_events(2)

        await _execute(
            "UPDATE audit_events SET event_type = 'forged' WHERE id = :id", id=events[0].id
        )

        assert (await _verify())["valid"] is False

    async def test_verify_endpoint_shape_is_additive(self, auditor_headers):
        await _log_events(2)

        async with new_client() as client:
            response = await client.get("/api/v1/audit/verify", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["events_checked"] == 2
        assert data["error"] is None
        assert data["legacy_events"] == 0
        assert data["warning"] is None

    async def test_concurrent_writers_do_not_fork_chain(self):
        async def write(i: int) -> None:
            async with TestSessionLocal() as db:
                await AuditService(db).log_event("c", "system", f"s{i}")
                await db.commit()

        await asyncio.gather(*(write(i) for i in range(8)))

        result = await _verify()
        assert result["valid"] is True
        assert result["events_checked"] == 8


class TestMigration:
    async def test_008_upgrades_from_previous_head(self):
        backend_dir = Path(__file__).resolve().parent.parent
        db_name = "sigilweaver_loom_hub_migtest"
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
            await asyncio.to_thread(alembic, "upgrade", "007")
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        "INSERT INTO audit_events (id, timestamp, event_type, actor_type, "
                        "actor_identity, details, event_hash) "
                        "VALUES (:id, now(), 'old', 'user', 'u', CAST('{}' AS jsonb), :h)"
                    ),
                    {"id": uuid.uuid4(), "h": "a" * 64},
                )

            await asyncio.to_thread(alembic, "upgrade", "008")

            async with engine.connect() as conn:
                versions = (
                    await conn.execute(text("SELECT hash_version FROM audit_events"))
                ).scalars().all()
            assert list(versions) == [1]

            await asyncio.to_thread(alembic, "downgrade", "007")
        finally:
            await engine.dispose()
            async with admin_engine.connect() as conn:
                await conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
