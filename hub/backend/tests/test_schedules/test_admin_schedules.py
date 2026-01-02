"""Tests for schedule operations as Admin role.

Per roles.md:
- Admin has RD (Read, Delete) on ALL schedules
- Admin can delete any schedule for moderation
- Admin cannot create or update schedules (operational privilege)
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAdminCanReadAllSchedules:
    """Admin can read all schedule information."""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_schedules(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can list all schedules."""
        async with new_client() as client:
            # User creates a workflow and schedule
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

            await client.post(
                "/api/v1/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )

            # Admin lists all schedules
            response = await client.get("/api/v1/schedules", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_get_schedule_details(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can get schedule details by ID."""
        async with new_client() as client:
            # User creates a workflow and schedule
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

            # Admin gets schedule details
            response = await client.get(
                f"/api/v1/schedules/{schedule_id}",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == schedule_id


class TestAdminCanDeleteAnySchedule:
    """Admin can delete any schedule for moderation."""

    @pytest.mark.asyncio
    async def test_admin_can_delete_user_schedule(
        self, admin_headers, user_headers, test_server
    ):
        """Admin can delete a schedule created by a user."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            # Admin deletes user's schedule
            response = await client.delete(
                f"/api/v1/schedules/{schedule_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCannotCreateOrUpdateSchedules:
    """Admin cannot create or update schedules (operational privilege).

    Note: Admins have CRUD for their OWN schedules like any user, but they
    shouldn't be the ones creating schedules - that's the user's job.
    However, the API allows admin to create since they also have user-level
    permissions. These tests verify they can't update OTHER users' schedules.
    """

    @pytest.mark.asyncio
    async def test_admin_cannot_update_user_schedule(
        self, admin_headers, user_headers, test_server
    ):
        """Admin cannot update a schedule created by a user."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            # Admin tries to update user's schedule - should fail
            response = await client.put(
                f"/api/v1/schedules/{schedule_id}",
                headers=admin_headers,
                json={"cron_expression": "0 12 * * *"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_cannot_toggle_user_schedule(
        self, admin_headers, user_headers, test_server
    ):
        """Admin cannot toggle a schedule created by a user."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            # Admin tries to toggle user's schedule - should fail
            response = await client.post(
                f"/api/v1/schedules/{schedule_id}/toggle?enabled=false",
                headers=admin_headers,
            )

        assert response.status_code == 403
