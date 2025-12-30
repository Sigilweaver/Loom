"""Tests for workflow operations as Admin/Owner role.

Per roles.md:
- Admin/Owner have RD (read, delete) on all Workflows
- Admin/Owner cannot create or update workflows
- The separation ensures admins manage infrastructure, users operate it
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAdminCanReadAllWorkflows:
    """Admin can read all workflows regardless of owner."""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_workflows(
        self, admin_headers, user_headers
    ):
        """Admin can list all workflows."""
        async with new_client() as client:
            # User creates a workflow
            await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )

            # Admin lists all
            response = await client.get("/api/workflows", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_admin_can_get_any_workflow(
        self, admin_headers, user_headers
    ):
        """Admin can get details of any workflow."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            response = await client.get(
                f"/api/workflows/{workflow_id}",
                headers=admin_headers,
            )

        assert response.status_code == 200


class TestAdminCanDeleteAnyWorkflow:
    """Admin can delete any workflow."""

    @pytest.mark.asyncio
    async def test_admin_can_delete_user_workflow(
        self, admin_headers, user_headers
    ):
        """Admin can delete a user's workflow."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            response = await client.delete(
                f"/api/workflows/{workflow_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCannotCreateOrUpdateWorkflows:
    """Admin cannot create or update workflows - that's User role territory."""

    @pytest.mark.asyncio
    async def test_admin_cannot_upload_workflow(self, admin_headers):
        """Admin cannot upload workflows."""
        async with new_client() as client:
            response = await client.post(
                "/api/workflows",
                headers=admin_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_cannot_update_workflow(
        self, admin_headers, user_headers
    ):
        """Admin cannot update workflows (even via PUT or PATCH)."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Try PATCH
            response = await client.patch(
                f"/api/workflows/{workflow_id}",
                headers=admin_headers,
                json={"folder_path": "/admin-moved"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_cannot_replace_workflow_file(
        self, admin_headers, user_headers
    ):
        """Admin cannot replace a workflow file."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Try PUT
            response = await client.put(
                f"/api/workflows/{workflow_id}",
                headers=admin_headers,
                files={
                    "file": (
                        "updated.swwf",
                        make_workflow_content(name="Admin Update"),
                        "application/octet-stream",
                    )
                },
            )

        assert response.status_code == 403


class TestOwnerHasSamePermissionsAsAdmin:
    """Owner has same workflow permissions as Admin (RD all)."""

    @pytest.mark.asyncio
    async def test_owner_can_list_all_workflows(
        self, owner_headers, user_headers
    ):
        """Owner can list all workflows."""
        async with new_client() as client:
            await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )

            response = await client.get("/api/workflows", headers=owner_headers)

        assert response.status_code == 200
        assert response.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_owner_can_delete_any_workflow(
        self, owner_headers, user_headers
    ):
        """Owner can delete any workflow."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/workflows",
                headers=user_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            response = await client.delete(
                f"/api/workflows/{workflow_id}",
                headers=owner_headers,
            )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_owner_cannot_upload_workflow(self, owner_headers):
        """Owner cannot upload workflows."""
        async with new_client() as client:
            response = await client.post(
                "/api/workflows",
                headers=owner_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )

        assert response.status_code == 403
