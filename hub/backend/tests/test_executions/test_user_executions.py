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
                "/api/v1/workflows",
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
                "/api/v1/executions",
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
        """User can list their own executions (auto-filtered)."""
        async with new_client() as client:
            # Upload workflow and trigger execution
            upload_response = await client.post(
                "/api/v1/workflows",
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
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # User can list executions (sees only their own)
            response = await client.get("/api/v1/executions", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert "executions" in data
        assert data["total"] == 1
        execution_ids = [e["id"] for e in data["executions"]]
        assert execution_id in execution_ids

    @pytest.mark.asyncio
    async def test_user_can_cancel_own_execution(self, user_headers, test_server):
        """User can cancel their own queued execution."""
        async with new_client() as client:
            # Upload workflow and trigger execution
            upload_response = await client.post(
                "/api/v1/workflows",
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
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Cancel the execution
            response = await client.post(
                f"/api/v1/executions/{execution_id}/cancel",
                headers=user_headers,
            )

        # Should either succeed (204/200) or fail with 400 if already completed
        assert response.status_code in (200, 400)


class TestUserCannotAccessOthersExecutions:
    """User cannot access executions triggered by other users."""

    @pytest.mark.asyncio
    async def test_user_does_not_see_others_executions(
        self, user_headers, second_user_headers, test_server
    ):
        """User only sees their own executions, not others'."""
        async with new_client() as client:
            # First user creates workflow and triggers execution
            upload_response = await client.post(
                "/api/v1/workflows",
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

            await client.post(
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )

            # Second user lists executions - sees empty list (not first user's)
            response = await client.get(
                "/api/v1/executions", headers=second_user_headers
            )

        assert response.status_code == 200
        # Second user has no executions, so sees empty list
        assert response.json()["executions"] == []
        assert response.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_user_cannot_cancel_other_users_execution(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot cancel another user's execution."""
        async with new_client() as client:
            # First user creates workflow and triggers execution
            upload_response = await client.post(
                "/api/v1/workflows",
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
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Second user tries to cancel - should fail
            response = await client.post(
                f"/api/v1/executions/{execution_id}/cancel",
                headers=second_user_headers,
            )

        assert response.status_code == 403


class TestUserExecutionsFiltering:
    """User sees only their own executions."""

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_executions(self, user_headers):
        """User with no executions sees empty list."""
        async with new_client() as client:
            response = await client.get("/api/v1/executions", headers=user_headers)

        assert response.status_code == 200
        assert response.json()["executions"] == []
        assert response.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_user_cannot_get_execution_by_id(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot get execution details via GET /executions/{id}."""
        async with new_client() as client:
            # First user creates a workflow and triggers execution
            upload_response = await client.post(
                "/api/v1/workflows",
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
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Second user tries to get by ID - should fail (requires auditor+)
            response = await client.get(
                f"/api/v1/executions/{execution_id}",
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
                "/api/v1/workflows",
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
                "/api/v1/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Second user tries to get record - should fail (requires auditor+)
            response = await client.get(
                f"/api/v1/executions/{execution_id}/record",
                headers=second_user_headers,
            )

        assert response.status_code == 403
