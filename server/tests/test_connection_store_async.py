"""Concurrency tests for the async ConnectionStore wrappers."""

import asyncio
import json
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from app.domain.connections.models import (
    CreateConnectionInput,
    DatabaseType,
    UpdateConnectionInput,
)
from app.domain.connections.store import ConnectionStore


@pytest.fixture
def store(tmp_path: Path) -> ConnectionStore:
    key = Fernet.generate_key().decode()
    return ConnectionStore(storage_path=tmp_path / "connections.json", encryption_key=key)


@pytest.mark.asyncio
async def test_concurrent_acreate_yields_consistent_state(store: ConnectionStore):
    """50 concurrent acreate calls must all land in the persisted file."""

    async def _create(i: int):
        return await store.acreate_connection(
            CreateConnectionInput(
                name=f"conn-{i:03d}",
                type=DatabaseType.POSTGRESQL,
                host="h",
                port=5432,
                database="d",
                username="u",
                password="p",
            )
        )

    results = await asyncio.gather(*(_create(i) for i in range(50)))
    assert len({c.id for c in results}) == 50

    # File on disk parses cleanly and contains all 50 records.
    raw = json.loads(Path(store._storage_path).read_text())
    assert len(raw["connections"]) == 50


@pytest.mark.asyncio
async def test_concurrent_aupdate_serializes_writes(store: ConnectionStore):
    """Interleaved updates on the same connection must produce a single
    well-formed JSON file (no torn writes)."""
    conn = await store.acreate_connection(
        CreateConnectionInput(
            name="target",
            type=DatabaseType.POSTGRESQL,
            host="h",
            port=5432,
            database="d",
            username="u",
            password="p",
        )
    )

    async def _update(i: int):
        return await store.aupdate_connection(
            conn.id,
            UpdateConnectionInput(host=f"host-{i}"),
        )

    await asyncio.gather(*(_update(i) for i in range(50)))

    raw = json.loads(Path(store._storage_path).read_text())
    assert len(raw["connections"]) == 1
    # The final host must be one of the 50 candidates - i.e. exactly one
    # update "won" rather than the file being corrupted.
    stored_host = raw["connections"][conn.id]["host"]
    assert stored_host in {f"host-{i}" for i in range(50)}


@pytest.mark.asyncio
async def test_concurrent_adelete_is_safe(store: ConnectionStore):
    """Concurrent deletes of distinct ids should all succeed."""
    ids: list[str] = []
    for i in range(20):
        info = await store.acreate_connection(
            CreateConnectionInput(
                name=f"d-{i}",
                type=DatabaseType.POSTGRESQL,
                host="h",
                port=5432,
                database="d",
                username="u",
                password="p",
            )
        )
        ids.append(info.id)

    await asyncio.gather(*(store.adelete_connection(cid) for cid in ids))
    raw = json.loads(Path(store._storage_path).read_text())
    assert raw["connections"] == {}
