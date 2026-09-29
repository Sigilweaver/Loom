"""Tests for the background execution runner and its capability-token handling.

Hub-triggered executions must authenticate to the Server with a single-use
capability token issued for the user the run belongs to. There must be no
fallback to the server's long-lived shared secret.
"""

from unittest.mock import patch

import pytest

from app.config import settings
from app.domain.auth.tokens import InMemoryTokenStore
from app.domain.capabilities import CapabilityIssuer
from app.domain.executions.service import ExecutionService
from app.domain.servers.client import ServerError
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import TestSessionLocal, create_user_direct

SERVER_SECRET = "per-server-secret-must-not-be-sent"


class FakeServerClient:
    """Records how it was constructed instead of calling a real server."""

    instances: list["FakeServerClient"] = []
    result: object = {"duration": 1.5}

    def __init__(self, endpoint_url: str, auth_token: str | None = None) -> None:
        self.endpoint_url = endpoint_url
        self.auth_token = auth_token
        FakeServerClient.instances.append(self)

    async def execute(self, workflow_content: bytes) -> object:
        return FakeServerClient.result


@pytest.fixture
def fake_client():
    FakeServerClient.instances = []
    FakeServerClient.result = {"duration": 1.5}
    with patch("app.domain.executions.service.ServerClient", FakeServerClient):
        yield FakeServerClient


@pytest.fixture
async def runner_env(setup_database, temp_storage):
    """A real issuer + in-memory token store, and a session maker on the test DB."""
    store = InMemoryTokenStore()
    issuer = CapabilityIssuer(store, settings)
    with (
        patch("app.db.database.async_session_maker", TestSessionLocal),
        patch("app.domain.capabilities.get_issuer", lambda: issuer),
    ):
        yield store


async def _run(execution, workflow, server) -> None:
    async with TestSessionLocal() as db:
        service = ExecutionService(db, file_store=WorkflowFileStore(settings.workflow_storage_path))
        await service._run_execution(execution.id, workflow.id, workflow.name, server)


async def _setup(triggered_by: str = "runner"):
    store = WorkflowFileStore(settings.workflow_storage_path)
    workflow = await db_helpers.make_workflow(store)
    server = await db_helpers.make_server(auth_token=SERVER_SECRET)
    execution = await db_helpers.make_execution(
        workflow.id, server.id, triggered_by=triggered_by
    )
    return workflow, server, execution


class TestCapabilityTokenIssuance:
    @pytest.mark.asyncio
    async def test_execution_authenticates_with_capability_token(
        self, runner_env, fake_client
    ):
        user, _ = await create_user_direct("runner", "user")
        workflow, server, execution = await _setup("runner")

        await _run(execution, workflow, server)

        assert len(fake_client.instances) == 1
        bearer = fake_client.instances[0].auth_token
        assert bearer != SERVER_SECRET
        # The bearer is a real, single-use capability token for the run-as user
        # on exactly this server.
        data = await runner_env.consume(bearer, str(server.id))
        assert data is not None
        assert data.user_id == str(user.id)
        assert (await db_helpers.reload_execution(execution.id)).status == "completed"

    @pytest.mark.asyncio
    async def test_issuance_failure_fails_execution_and_never_uses_server_secret(
        self, setup_database, temp_storage, fake_client
    ):
        await create_user_direct("runner", "user")
        workflow, server, execution = await _setup("runner")

        def broken_issuer():
            raise RuntimeError("issuer unavailable")

        with (
            patch("app.db.database.async_session_maker", TestSessionLocal),
            patch("app.domain.capabilities.get_issuer", broken_issuer),
        ):
            await _run(execution, workflow, server)

        assert fake_client.instances == []  # the server was never contacted
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.success is False
        assert row.error_message is not None
        assert "authorization token" in row.error_message
        assert SERVER_SECRET not in row.error_message

    @pytest.mark.asyncio
    async def test_token_store_failure_fails_execution(
        self, setup_database, temp_storage, fake_client
    ):
        await create_user_direct("runner", "user")
        workflow, server, execution = await _setup("runner")

        class BrokenStore(InMemoryTokenStore):
            async def create(self, user_id, server_id, ttl_seconds=300):
                raise ConnectionError("db down")

        issuer = CapabilityIssuer(BrokenStore(), settings)
        with (
            patch("app.db.database.async_session_maker", TestSessionLocal),
            patch("app.domain.capabilities.get_issuer", lambda: issuer),
        ):
            await _run(execution, workflow, server)

        assert fake_client.instances == []
        assert (await db_helpers.reload_execution(execution.id)).status == "failed"

    @pytest.mark.asyncio
    async def test_unknown_user_fails_execution(self, runner_env, fake_client):
        workflow, server, execution = await _setup("ghost")

        await _run(execution, workflow, server)

        assert fake_client.instances == []
        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.error_message is not None
        assert "no longer exists" in row.error_message

    @pytest.mark.asyncio
    async def test_scheduled_execution_runs_as_schedule_creator(
        self, runner_env, fake_client
    ):
        creator, _ = await create_user_direct("schedule-owner", "user")
        store = WorkflowFileStore(settings.workflow_storage_path)
        workflow = await db_helpers.make_workflow(store)
        server = await db_helpers.make_server(auth_token=SERVER_SECRET)
        schedule = await db_helpers.make_schedule(workflow.id, created_by="schedule-owner")
        execution = await db_helpers.make_execution(
            workflow.id,
            server.id,
            trigger_type="scheduled",
            triggered_by="scheduler",
            schedule_id=schedule.id,
        )

        await _run(execution, workflow, server)

        bearer = fake_client.instances[0].auth_token
        data = await runner_env.consume(bearer, str(server.id))
        assert data is not None
        assert data.user_id == str(creator.id)

    @pytest.mark.asyncio
    async def test_server_error_marks_execution_failed(self, runner_env, fake_client):
        await create_user_direct("runner", "user")
        workflow, server, execution = await _setup("runner")
        fake_client.result = ServerError(message="boom", status_code=500)

        await _run(execution, workflow, server)

        row = await db_helpers.reload_execution(execution.id)
        assert row.status == "failed"
        assert row.error_message == "boom"


class TestAuthorizeWithNonUserPrincipal:
    @pytest.mark.asyncio
    async def test_authorize_denies_token_for_non_user_principal(self, setup_database):
        """A token whose principal is not a Hub user id is denied, not a 500."""
        from app.domain.auth.tokens import get_token_store, init_token_store
        from tests.conftest import new_client

        init_token_store("memory")
        server = await db_helpers.make_server(auth_token="srv-token")
        token = await get_token_store().create(
            user_id="hub-system", server_id=str(server.id)
        )

        async with new_client() as client:
            response = await client.post(
                "/api/v1/internal/authorize",
                headers={"Authorization": "Bearer srv-token"},
                json={"server_token": token, "request_type": "execute"},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["authorized"] is False
        assert "not issued for a Hub user" in body["error"]
