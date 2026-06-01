"""Integration tests for execution artifact listing and download routes.

Verifies that an execution's outputs are retrievable, checksum-verified, and
access-controlled (owner or auditor+).
"""

import hashlib
import tempfile
from uuid import UUID

import pytest
from app.config import settings
from app.domain.artifacts import ArtifactService

from tests.conftest import TestSessionLocal, make_workflow_content, new_client

# A single output socket with two rows; mirrors the Server execute response.
EXEC_RESULT = {
    "tool_id": "final-tool",
    "outputs": {
        "out1": {
            "data": [
                {"a": 1, "b": "x"},
                {"a": 2, "b": "y"},
            ],
            "data_schema": {"columns": [{"name": "a"}, {"name": "b"}]},
            "row_count": 2,
        }
    },
}
EXPECTED_CSV = b"a,b\n1,x\n2,y\n"
EXPECTED_SHA = hashlib.sha256(EXPECTED_CSV).hexdigest()


@pytest.fixture
async def artifact_storage(setup_database):
    """Point the artifact store at an isolated temp directory."""
    with tempfile.TemporaryDirectory() as tmp:
        original = settings.artifact_storage_path
        settings.artifact_storage_path = tmp
        yield tmp
        settings.artifact_storage_path = original


async def _trigger_execution(client, headers, server_id) -> str:
    """Upload a workflow and trigger an execution; return its id."""
    upload = await client.post(
        "/api/v1/workflows",
        headers=headers,
        files={
            "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
        },
        data={"folder_path": "/", "tags": ""},
    )
    assert upload.status_code == 201, upload.text
    workflow_id = upload.json()["id"]

    trigger = await client.post(
        "/api/v1/executions",
        headers=headers,
        json={"workflow_id": workflow_id, "server_id": server_id},
    )
    assert trigger.status_code == 201, trigger.text
    return trigger.json()["id"]


async def _store_outputs(execution_id: str) -> None:
    """Persist EXEC_RESULT artifacts for an execution via the service."""
    async with TestSessionLocal() as session:
        artifacts = await ArtifactService(session).store_execution_outputs(
            UUID(execution_id), EXEC_RESULT
        )
        assert len(artifacts) == 1


class TestArtifactRetrieval:
    @pytest.mark.asyncio
    async def test_owner_can_list_artifacts(
        self, artifact_storage, user_headers, test_server
    ):
        async with new_client() as client:
            execution_id = await _trigger_execution(
                client, user_headers, test_server["id"]
            )
            await _store_outputs(execution_id)

            resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts", headers=user_headers
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 1
        artifact = data["artifacts"][0]
        assert artifact["name"] == "output-out1.csv"
        assert artifact["media_type"] == "text/csv"
        assert artifact["sha256"] == EXPECTED_SHA
        assert artifact["size_bytes"] == len(EXPECTED_CSV)
        assert artifact["row_count"] == 2

    @pytest.mark.asyncio
    async def test_owner_can_download_artifact_with_checksum(
        self, artifact_storage, user_headers, test_server
    ):
        async with new_client() as client:
            execution_id = await _trigger_execution(
                client, user_headers, test_server["id"]
            )
            await _store_outputs(execution_id)

            list_resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts", headers=user_headers
            )
            artifact_id = list_resp.json()["artifacts"][0]["id"]

            resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts/{artifact_id}",
                headers=user_headers,
            )

        assert resp.status_code == 200, resp.text
        assert resp.content == EXPECTED_CSV
        assert resp.headers["x-checksum-sha256"] == EXPECTED_SHA
        assert hashlib.sha256(resp.content).hexdigest() == EXPECTED_SHA
        assert "attachment" in resp.headers["content-disposition"]
        assert "output-out1.csv" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_auditor_can_access_other_users_artifacts(
        self, artifact_storage, user_headers, auditor_headers, test_server
    ):
        async with new_client() as client:
            execution_id = await _trigger_execution(
                client, user_headers, test_server["id"]
            )
            await _store_outputs(execution_id)

            resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts",
                headers=auditor_headers,
            )

        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_other_user_is_forbidden(
        self, artifact_storage, user_headers, second_user_headers, test_server
    ):
        async with new_client() as client:
            execution_id = await _trigger_execution(
                client, user_headers, test_server["id"]
            )
            await _store_outputs(execution_id)

            resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts",
                headers=second_user_headers,
            )

        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_execution_returns_404(self, artifact_storage, user_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        async with new_client() as client:
            resp = await client.get(
                f"/api/v1/executions/{fake_id}/artifacts", headers=user_headers
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_missing_artifact_returns_404(
        self, artifact_storage, user_headers, test_server
    ):
        fake_artifact = "00000000-0000-0000-0000-000000000000"
        async with new_client() as client:
            execution_id = await _trigger_execution(
                client, user_headers, test_server["id"]
            )
            resp = await client.get(
                f"/api/v1/executions/{execution_id}/artifacts/{fake_artifact}",
                headers=user_headers,
            )
        assert resp.status_code == 404
