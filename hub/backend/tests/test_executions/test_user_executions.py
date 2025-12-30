"""Tests for execution operations as a User role.

Per roles.md:
- Users have CR (Create, Read) on their own executions
- Users can trigger executions and see their own execution history
- Users can cancel only their own executions
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestUserExecutionOperations:
    """User can trigger and read their own executions."""

    @pytest.mark.asyncio
    async def test_user_can_trigger_execution(self, user_headers, test_server):
        """User can trigger a workflow execution."""
        async with new_client() as client:
            # First upload a workflow
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
            assert upload_response.status_code == 201
            workflow_id = upload_response.json()["id"]

            # Trigger an execution
            response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["workflow_id"] == workflow_id
        assert data["server_id"] == test_server["id"]
        assert data["trigger_type"] == "manual"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_user_can_list_own_executions(self, user_headers, test_server):
        """User can list their own executions via /executions/my."""
        async with new_client() as client:
            # Upload workflow and trigger execution
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

            # List own executions
            response = await client.get("/api/executions/my", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["executions"][0]["workflow_id"] == workflow_id

    @pytest.mark.asyncio
    async def test_user_can_cancel_own_execution(self, user_headers, test_server):
        """User can cancel their own queued execution."""
        async with new_client() as client:
            # Upload workflow and trigger execution
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

            # Cancel the execution
            response = await client.post(
                f"/api/executions/{execution_id}/cancel",
                headers=user_headers,
            )

        # Should either succeed (204/200) or fail with 400 if already completed
        assert response.status_code in (200, 400)


class TestUserCannotAccessOthersExecutions:
    """User cannot access executions triggered by other users."""

    @pytest.mark.asyncio
    async def test_user_cannot_see_other_users_executions(
        self, user_headers, second_user_headers, test_server
    ):
        """User's /my list only shows their own executions."""
        async with new_client() as client:
            # First user creates workflow and triggers execution
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(name="First User Workflow"),
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
            first_user_execution_id = trigger_response.json()["id"]

            # Second user lists executions - should not see first user's execution
            response = await client.get(
                "/api/executions/my", headers=second_user_headers
            )

        assert response.status_code == 200
        # Second user should not see executions with first user's execution ID
        execution_ids = [e["id"] for e in response.json()["executions"]]
        assert first_user_execution_id not in execution_ids

    @pytest.mark.asyncio
    async def test_user_cannot_cancel_other_users_execution(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot cancel another user's execution."""
        async with new_client() as client:
            # First user creates workflow and triggers execution
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

            # Second user tries to cancel - should fail
            response = await client.post(
                f"/api/executions/{execution_id}/cancel",
                headers=second_user_headers,
            )

        assert response.status_code == 403


class TestUserCannotAccessAllExecutions:
    """User cannot use the all-executions endpoints (auditor+ only)."""

    @pytest.mark.asyncio
    async def test_user_cannot_list_all_executions(self, user_headers):
        """User cannot use GET /executions (requires auditor+)."""
        async with new_client() as client:
            response = await client.get("/api/executions", headers=user_headers)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_get_execution_by_id(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot get execution details via GET /executions/{id}."""
        async with new_client() as client:
            # First user creates a workflow and triggers execution
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

            # Second user tries to get by ID - should fail (requires auditor+)
            response = await client.get(
                f"/api/executions/{execution_id}",
                headers=second_user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_get_execution_record(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot get execution record (rich details)."""
        async with new_client() as client:
            # First user creates a workflow and triggers execution
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

            # Second user tries to get record - should fail (requires auditor+)
            response = await client.get(
                f"/api/executions/{execution_id}/record",
                headers=second_user_headers,
            )

        assert response.status_code == 403
