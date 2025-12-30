"""Tests for execution operations as Auditor role.

Per roles.md:
- Auditor has Read on ALL executions (for audit purposes)
- Auditor cannot trigger or cancel executions
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAuditorCanReadAllExecutions:
    """Auditor can read all execution information for audit purposes."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_executions(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can list all executions."""
        async with new_client() as client:
            # User creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )

            # Auditor lists all executions
            response = await client.get("/api/executions", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_execution_details(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can get execution details by ID."""
        async with new_client() as client:
            # User creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Auditor gets execution details
            response = await client.get(
                f"/api/executions/{execution_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == execution_id

    @pytest.mark.asyncio
    async def test_auditor_can_get_execution_record(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can get execution record (rich details)."""
        async with new_client() as client:
            # User creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Auditor gets execution record - may be 404 if no record created yet
            # but should NOT be 403
            response = await client.get(
                f"/api/executions/{execution_id}/record",
                headers=auditor_headers,
            )

        # Either gets record (200) or record not found (404), but not forbidden
        assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_auditor_can_get_execution_code(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can get generated code for an execution."""
        async with new_client() as client:
            # User creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Auditor gets execution code - may be 404 if no record yet
            response = await client.get(
                f"/api/executions/{execution_id}/code",
                headers=auditor_headers,
            )

        assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_auditor_can_get_execution_logs(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can get logs for an execution."""
        async with new_client() as client:
            # User creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Auditor gets execution logs - may be 404 if no record yet
            response = await client.get(
                f"/api/executions/{execution_id}/logs",
                headers=auditor_headers,
            )

        assert response.status_code in (200, 404)


class TestAuditorCannotTriggerOrCancelExecutions:
    """Auditor cannot trigger or cancel executions."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_trigger_execution(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot trigger executions."""
        async with new_client() as client:
            # User creates a workflow
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Auditor tries to trigger execution - should fail
            response = await client.post(
                "/api/executions",
                headers=auditor_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_cancel_execution(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot cancel executions."""
        async with new_client() as client:
            # User creates workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Auditor tries to cancel - should fail
            response = await client.post(
                f"/api/executions/{execution_id}/cancel",
                headers=auditor_headers,
            )

        assert response.status_code == 403
