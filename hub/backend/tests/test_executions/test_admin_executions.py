"""Tests for execution operations as Admin role.

Per roles.md:
- Admin has R (Read) on ALL executions
- Admin cannot trigger or cancel executions (operational privilege)
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAdminCanReadAllExecutions:
    """Admin can read all execution information."""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_executions(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can list all executions."""
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

            # Admin lists all executions
            response = await client.get("/api/executions", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_get_execution_details(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can get execution details by ID."""
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

            # Admin gets execution details
            response = await client.get(
                f"/api/executions/{execution_id}",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == execution_id

    @pytest.mark.asyncio
    async def test_admin_can_get_execution_record(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can get execution record (rich details)."""
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

            # Admin gets execution record - may be 404 if no record created yet
            response = await client.get(
                f"/api/executions/{execution_id}/record",
                headers=admin_headers,
            )

        # Either gets record (200) or record not found (404), but not forbidden
        assert response.status_code in (200, 404)


class TestAdminCannotTriggerOrCancelExecutions:
    """Admin cannot trigger executions (operational privilege for users only).

    Per roles.md, admins have infrastructure management responsibilities,
    not operational workflow execution privileges.
    """

    @pytest.mark.asyncio
    async def test_admin_cannot_trigger_execution(self, admin_headers, user_headers, test_server):
        """Admin cannot trigger executions (requires user role)."""
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

            # Admin tries to trigger execution - should fail
            response = await client.post(
                "/api/executions",
                headers=admin_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_cannot_cancel_execution(self, admin_headers, user_headers, test_server):
        """Admin cannot cancel executions (requires user role)."""
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

            # User triggers execution
            trigger_response = await client.post(
                "/api/executions",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "server_id": test_server["id"],
                },
            )
            execution_id = trigger_response.json()["id"]

            # Admin tries to cancel - should fail (requires user role)
            response = await client.post(
                f"/api/executions/{execution_id}/cancel",
                headers=admin_headers,
            )

        assert response.status_code == 403


class TestAdminCanReadOtherUsersExecutions:
    """Admin can read executions triggered by other users."""

    @pytest.mark.asyncio
    async def test_admin_can_view_user_execution(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can view an execution triggered by a user."""
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

            # Admin can view the execution
            response = await client.get(
                f"/api/executions/{execution_id}",
                headers=admin_headers,
            )

        assert response.status_code == 200
