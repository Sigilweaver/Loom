"""Tests for schedule operations as Auditor role.

Per roles.md:
- Auditor has Read on ALL schedules (for audit purposes)
- Auditor cannot create, update, or delete schedules
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAuditorCanReadAllSchedules:
    """Auditor can read all schedule information for audit purposes."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_schedules(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can list all schedules."""
        async with new_client() as client:
            # User creates a workflow and schedule
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
                "/api/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )

            # Auditor lists all schedules
            response = await client.get("/api/schedules", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_schedule_details(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor can get schedule details by ID."""
        async with new_client() as client:
            # User creates a workflow and schedule
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

            create_response = await client.post(
                "/api/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Auditor gets schedule details
            response = await client.get(
                f"/api/schedules/{schedule_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == schedule_id


class TestAuditorCannotModifySchedules:
    """Auditor cannot create, update, or delete schedules."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_create_schedule(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot create schedules."""
        async with new_client() as client:
            # User creates a workflow (auditor can't even create workflows)
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

            # Auditor tries to create a schedule - should fail
            response = await client.post(
                "/api/schedules",
                headers=auditor_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_update_schedule(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot update schedules."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            create_response = await client.post(
                "/api/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Auditor tries to update - should fail
            response = await client.put(
                f"/api/schedules/{schedule_id}",
                headers=auditor_headers,
                json={"cron_expression": "0 12 * * *"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_delete_schedule(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot delete schedules."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            create_response = await client.post(
                "/api/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Auditor tries to delete - should fail
            response = await client.delete(
                f"/api/schedules/{schedule_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_toggle_schedule(
        self, auditor_headers, user_headers, test_server
    ):
        """Auditor cannot toggle schedules."""
        async with new_client() as client:
            # User creates workflow and schedule
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

            create_response = await client.post(
                "/api/schedules",
                headers=user_headers,
                json={
                    "workflow_id": workflow_id,
                    "cron_expression": "0 6 * * *",
                    "target_server_id": test_server["id"],
                },
            )
            schedule_id = create_response.json()["id"]

            # Auditor tries to toggle - should fail
            response = await client.post(
                f"/api/schedules/{schedule_id}/toggle?enabled=false",
                headers=auditor_headers,
            )

        assert response.status_code == 403
