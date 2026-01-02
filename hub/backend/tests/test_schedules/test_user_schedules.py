"""Tests for schedule operations as a User role.

Per roles.md:
- Users have CRUD (own) on Schedules
- Users can only see schedules they created
- Admins can delete any schedule but cannot create or edit
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestUserScheduleCRUD:
    """User can create, read, update, delete their own schedules."""

    @pytest.mark.asyncio
    async def test_user_can_create_schedule(self, user_headers, test_server):
        """User can create a schedule for their workflow."""
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

            # Create a schedule
            response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "timezone": "UTC",
                    "target_server_id": test_server["id"],
                    "enabled": True,
                    "description": "Daily 6 AM schedule",
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["cron_expression"] == "0 6 * * *"
        assert data["workflow_id"] == workflow_id
        assert "id" in data

    @pytest.mark.asyncio
    async def test_user_can_list_own_schedules(self, user_headers, test_server):
        """User can list their own schedules (auto-filtered)."""
        async with new_client() as client:
            # Upload workflow and create schedule
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

            schedule_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = schedule_response.json()["id"]

            # User can list schedules (sees only their own)
            response = await client.get("/api/v1/schedules", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert "schedules" in data
        schedule_ids = [s["id"] for s in data["schedules"]]
        assert schedule_id in schedule_ids

    @pytest.mark.asyncio
    async def test_user_can_update_own_schedule(self, user_headers, test_server):
        """User can update their own schedule."""
        async with new_client() as client:
            # Create workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Update the schedule
            response = await client.put(
                f"/api/v1/schedules/{schedule_id}",
                headers=user_headers,
                json={
                    "cron_expression": "0 12 * * *",
                    "timezone": "UTC",
                    "description": "Changed to noon",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["cron_expression"] == "0 12 * * *"
        assert data["description"] == "Changed to noon"

    @pytest.mark.asyncio
    async def test_user_can_toggle_own_schedule(self, user_headers, test_server):
        """User can enable/disable their own schedule."""
        async with new_client() as client:
            # Create workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                    "enabled": True,
                },
            )
            schedule_id = create_response.json()["id"]

            # Toggle the schedule off
            response = await client.post(
                f"/api/v1/schedules/{schedule_id}/toggle?enabled=false",
                headers=user_headers,
            )

        assert response.status_code == 200
        assert response.json()["enabled"] is False

    @pytest.mark.asyncio
    async def test_user_can_delete_own_schedule(self, user_headers, test_server):
        """User can delete their own schedule."""
        async with new_client() as client:
            # Create workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Delete the schedule
            response = await client.delete(
                f"/api/v1/schedules/{schedule_id}",
                headers=user_headers,
            )

        assert response.status_code == 204


class TestUserCannotAccessOthersSchedules:
    """User cannot access schedules created by other users."""

    @pytest.mark.asyncio
    async def test_user_does_not_see_others_schedules(
        self, user_headers, second_user_headers, test_server
    ):
        """User only sees their own schedules, not others'."""
        async with new_client() as client:
            # First user creates workflow and schedule
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
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )

            # Second user lists schedules - sees empty list (not first user's)
            response = await client.get(
                "/api/v1/schedules", headers=second_user_headers
            )

        assert response.status_code == 200
        # Second user has no schedules, so sees empty list
        assert response.json()["schedules"] == []

    @pytest.mark.asyncio
    async def test_user_cannot_update_other_users_schedule(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot update another user's schedule."""
        async with new_client() as client:
            # First user creates workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Second user tries to update - should fail
            response = await client.put(
                f"/api/v1/schedules/{schedule_id}",
                headers=second_user_headers,
                json={"cron_expression": "0 12 * * *"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_other_users_schedule(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot delete another user's schedule."""
        async with new_client() as client:
            # First user creates workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Second user tries to delete - should fail
            response = await client.delete(
                f"/api/v1/schedules/{schedule_id}",
                headers=second_user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_toggle_other_users_schedule(
        self, user_headers, second_user_headers, test_server
    ):
        """User cannot toggle another user's schedule."""
        async with new_client() as client:
            # First user creates workflow and schedule
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Second user tries to toggle - should fail
            response = await client.post(
                f"/api/v1/schedules/{schedule_id}/toggle?enabled=false",
                headers=second_user_headers,
            )

        assert response.status_code == 403


class TestUserSchedulesFiltering:
    """User sees only their own schedules."""

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_schedules(self, user_headers):
        """User with no schedules sees empty list."""
        async with new_client() as client:
            response = await client.get("/api/v1/schedules", headers=user_headers)

        assert response.status_code == 200
        assert response.json()["schedules"] == []
        assert response.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_user_cannot_get_schedule_by_id(
        self, user_headers, auditor_headers, test_server
    ):
        """User cannot get schedule details via GET /schedules/{id}."""
        async with new_client() as client:
            # User creates a workflow and schedule (another user would need
            # to be able to create, but we use auditor to read the ID)
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

            create_response = await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # User tries to get by ID via /schedules/{id} endpoint (auditor+)
            response = await client.get(
                f"/api/v1/schedules/{schedule_id}",
                headers=user_headers,
            )

        assert response.status_code == 403
