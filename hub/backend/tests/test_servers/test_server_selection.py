"""Tests for automatic server selection (no server named by the caller)."""

import random
from collections import Counter

import pytest

from app.config import settings
from app.db.models import Server
from app.domain.servers.selection import NoOnlineServerError, select_online_server
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import TestSessionLocal, new_client


async def _select(rng: random.Random | None = None) -> Server:
    async with TestSessionLocal() as db:
        return await select_online_server(db, rng)


class TestSelectOnlineServer:
    @pytest.mark.asyncio
    async def test_no_online_server_raises(self, setup_database):
        await db_helpers.make_server("offline-one", status="offline")

        with pytest.raises(NoOnlineServerError):
            await _select()

    @pytest.mark.asyncio
    async def test_offline_servers_are_never_chosen(self, setup_database):
        await db_helpers.make_server("a-offline", status="offline")
        online = await db_helpers.make_server("z-online")
        await db_helpers.make_server("m-unknown", status="unknown")

        for _ in range(10):
            assert (await _select()).id == online.id

    @pytest.mark.asyncio
    async def test_idle_servers_share_selections(self, setup_database):
        """With equal load every server is picked, not always the first one."""
        names = ["alpha", "bravo", "charlie"]
        for name in names:
            await db_helpers.make_server(name)
        rng = random.Random(1234)

        picked = Counter([(await _select(rng)).name for _ in range(60)])

        assert set(picked) == set(names)
        assert all(count >= 10 for count in picked.values())

    @pytest.mark.asyncio
    async def test_least_loaded_server_wins(self, setup_database, temp_storage):
        busy = await db_helpers.make_server("alpha")
        idle = await db_helpers.make_server("bravo")
        workflow = await db_helpers.make_workflow(WorkflowFileStore(settings.workflow_storage_path))
        await db_helpers.make_execution(workflow.id, busy.id, status="running")
        await db_helpers.make_execution(workflow.id, busy.id, status="queued")

        for seed in range(10):
            assert (await _select(random.Random(seed))).id == idle.id

    @pytest.mark.asyncio
    async def test_finished_executions_do_not_count_as_load(
        self, setup_database, temp_storage
    ):
        first = await db_helpers.make_server("alpha")
        second = await db_helpers.make_server("bravo")
        workflow = await db_helpers.make_workflow(WorkflowFileStore(settings.workflow_storage_path))
        for status in ("completed", "failed", "cancelled"):
            await db_helpers.make_execution(workflow.id, first.id, status=status)

        picked = {(await _select(random.Random(seed))).id for seed in range(30)}

        assert picked == {first.id, second.id}


class TestAutoSelectionThroughEntryPoints:
    @pytest.mark.asyncio
    async def test_capability_token_auto_selection_spreads_across_servers(
        self, setup_database, user_headers, token_issuer
    ):
        for name in ("alpha", "bravo"):
            await db_helpers.make_server(name)

        endpoints = set()
        async with new_client() as client:
            for _ in range(40):
                response = await client.post(
                    "/api/v1/capabilities/token", headers=user_headers, json={}
                )
                assert response.status_code == 200, response.text
                endpoints.add(response.json()["server_endpoint"])

        assert endpoints == {"http://alpha.invalid:25811", "http://bravo.invalid:25811"}

    @pytest.mark.asyncio
    async def test_execution_service_auto_selection_spreads_across_servers(
        self, setup_database, temp_storage
    ):
        from app.domain.executions.service import ExecutionService

        for name in ("alpha", "bravo"):
            await db_helpers.make_server(name)

        chosen = set()
        for _ in range(40):
            # A fresh service per call mirrors one service instance per request.
            async with TestSessionLocal() as db:
                chosen.add((await ExecutionService(db)._select_server()).name)

        assert chosen == {"alpha", "bravo"}
