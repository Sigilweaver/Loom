"""Bad input and partial failures return clear errors instead of 500s."""

import asyncio
import json
from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import update

from app.api.v1.routes import executions as executions_routes
from app.config import settings
from app.db.models import Execution, Server, Workflow
from app.domain.audit.service import AuditService
from app.domain.servers import health_poller as health_poller_module
from app.domain.servers.client import HealthResponse, ServerClient, ServerError
from app.domain.servers.health_poller import HealthPoller
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import TestSessionLocal, new_client


class TestServerClient:
    async def test_invalid_url_is_a_server_error(self):
        result = await ServerClient("http://host:abc").health()
        assert isinstance(result, ServerError)

    @pytest.mark.parametrize("payload", [[1, 2], "ok", 3])
    async def test_non_object_health_body_is_a_server_error(self, payload):
        async def fake_get(self, url, **kwargs):
            return httpx.Response(200, json=payload, request=httpx.Request("GET", url))

        with patch.object(httpx.AsyncClient, "get", fake_get):
            result = await ServerClient("http://srv.invalid").health()
        assert isinstance(result, ServerError)

    async def test_one_failing_server_does_not_block_the_others(self, setup_database):
        bad = await db_helpers.make_server("bad", status="online")
        good = await db_helpers.make_server("good", status="unknown")

        async def health(self):
            if "bad" in self.endpoint_url:
                raise RuntimeError("unexpected")
            return HealthResponse(status="ok", version="1.0")

        with (
            patch.object(health_poller_module, "async_session_maker", TestSessionLocal),
            patch.object(ServerClient, "health", health),
        ):
            await HealthPoller()._poll_all_servers()
        async with TestSessionLocal() as db:
            assert (await db.get(Server, good.id)).status == "online"
            assert (await db.get(Server, bad.id)).status == "online"  # untouched


class TestServerRoutes:
    async def test_delete_server_with_history_is_409(self, admin_headers):
        workflow = await db_helpers.make_workflow(
            WorkflowFileStore(settings.workflow_storage_path)
        )
        server = await db_helpers.make_server()
        await db_helpers.make_execution(workflow.id, server.id)
        async with new_client() as client:
            response = await client.delete(f"/api/v1/servers/{server.id}", headers=admin_headers)
        assert response.status_code == 409
        assert "execution" in response.json()["detail"]

    async def test_token_cannot_be_shared_via_update(self, admin_headers):
        first = await db_helpers.make_server("one", auth_token="token-one")
        await db_helpers.make_server("two", auth_token="token-two")
        async with new_client() as client:
            response = await client.put(
                f"/api/v1/servers/{first.id}",
                headers=admin_headers,
                json={"auth_token": "token-two"},
            )
        assert response.status_code == 409

    async def test_reregistration_with_shared_token_is_409(self, admin_headers):
        await db_helpers.make_server("one", auth_token="shared")
        await db_helpers.make_server("two", auth_token="shared")
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers",
                headers=admin_headers,
                json={
                    "name": "again",
                    "endpoint_url": "http://localhost:1",
                    "auth_token": "shared",
                },
            )
        assert response.status_code == 409


class TestSchedules:
    async def _schedules(self, user_headers):
        workflow = await db_helpers.make_workflow(
            WorkflowFileStore(settings.workflow_storage_path)
        )
        async with TestSessionLocal() as db:
            await db.execute(
                update(Workflow).where(Workflow.id == workflow.id).values(uploaded_by="testuser")
            )
            await db.commit()
        on = await db_helpers.make_schedule(workflow.id, created_by="testuser")
        off = await db_helpers.make_schedule(workflow.id, created_by="testuser", enabled=False)
        return on, off

    @pytest.mark.parametrize("flag,expected", [("true", "on"), ("false", "off")])
    async def test_enabled_filter(self, user_headers, flag, expected):
        on, off = await self._schedules(user_headers)
        async with new_client() as client:
            body = (
                await client.get(f"/api/v1/schedules?enabled={flag}", headers=user_headers)
            ).json()
        assert [s["id"] for s in body["schedules"]] == [str((on if expected == "on" else off).id)]
        assert body["total"] == 1

    async def test_run_now_without_online_server_is_503(self, user_headers):
        on, _ = await self._schedules(user_headers)
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/schedules/{on.id}/trigger", headers=user_headers
            )
        assert response.status_code == 503


class TestAudit:
    async def test_overlong_client_fields_are_clipped(self, setup_database):
        async with TestSessionLocal() as db:
            event = await AuditService(db).log_event(
                event_type="test.event",
                actor_type="user",
                actor_identity="u" * 300,
                client_ip="1" * 60,
                user_agent="A" * 2000,
            )
            await db.commit()
        assert len(event.user_agent) == 512
        assert len(event.client_ip) == 45
        assert len(event.actor_identity) == 255


class TestExecutionStream:
    async def test_stream_sees_changes_made_by_another_process(self, user_headers):
        workflow = await db_helpers.make_workflow(
            WorkflowFileStore(settings.workflow_storage_path)
        )
        server = await db_helpers.make_server()
        execution = await db_helpers.make_execution(
            workflow.id, server.id, triggered_by="testuser"
        )

        async def finish_elsewhere():
            await asyncio.sleep(0.2)
            async with TestSessionLocal() as db:
                await db.execute(
                    update(Execution)
                    .where(Execution.id == execution.id)
                    .values(status="completed", success=True)
                )
                await db.commit()

        statuses = []

        async def read_stream() -> None:
            async with new_client() as client:
                async with client.stream(
                    "GET", f"/api/v1/executions/{execution.id}/stream", headers=user_headers
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            statuses.append(json.loads(line[5:])["status"])

        with patch.object(executions_routes, "_SSE_HEARTBEAT_SECONDS", 0.05):
            finisher = asyncio.create_task(finish_elsewhere())
            await asyncio.wait_for(read_stream(), timeout=10)
            await finisher
        assert statuses == ["queued", "completed"]


class TestWorkflowOwnership:
    """roles.md: Users run and schedule only their own workflows."""

    async def _foreign_workflow(self):
        workflow = await db_helpers.make_workflow(
            WorkflowFileStore(settings.workflow_storage_path)
        )  # uploaded_by="test", not "testuser"
        await db_helpers.make_server()
        return workflow

    async def test_cannot_run_another_users_workflow(self, user_headers):
        workflow = await self._foreign_workflow()
        async with new_client() as client:
            response = await client.post(
                "/api/v1/executions",
                headers=user_headers,
                json={"workflow_id": str(workflow.id)},
            )
        assert response.status_code == 403

    async def test_cannot_schedule_another_users_workflow(self, user_headers):
        workflow = await self._foreign_workflow()
        async with new_client() as client:
            response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={"workflow_id": str(workflow.id), "cron_expression": "0 * * * *"},
            )
        assert response.status_code == 403
