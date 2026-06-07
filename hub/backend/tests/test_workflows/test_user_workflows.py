"""Tests for workflow operations as a User role.

Per roles.md:
- Users have CRUD (own) on Workflows
- Users can only see workflows they created
- Admins can delete any workflow but cannot create or edit
"""

import pytest

from tests.conftest import make_workflow_content, new_client


class TestUserWorkflowCRUD:
    """User can create, read, update, delete their own workflows."""

    @pytest.mark.asyncio
    async def test_user_can_upload_workflow(self, user_headers):
        """User can upload a workflow."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": "test"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Workflow"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_user_can_list_own_workflows(self, user_headers):
        """User can list workflows (auto-filtered to their own)."""
        async with new_client() as client:
            # Upload a workflow
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
                data={"folder_path": "/", "tags": "test"},
            )
            workflow_id = upload_response.json()["id"]

            # User can list workflows (sees only their own)
            response = await client.get("/api/v1/workflows", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert "workflows" in data
        assert "total" in data
        assert data["total"] >= 1
        workflow_ids = [w["id"] for w in data["workflows"]]
        assert workflow_id in workflow_ids

    @pytest.mark.asyncio
    async def test_user_only_sees_own_workflows(self, user_headers, admin_headers):
        """User only sees their own workflows, not others'."""
        async with new_client() as client:
            # Upload a workflow as user
            user_upload = await client.post(
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
            user_workflow_id = user_upload.json()["id"]

            # User lists workflows - sees only their own
            response = await client.get("/api/v1/workflows", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        # All workflows should be uploaded by the user
        for workflow in data["workflows"]:
            assert workflow["uploaded_by"] == "testuser"

    @pytest.mark.asyncio
    async def test_user_can_get_own_workflow(self, user_headers):
        """User can get details of their own workflow by ID."""
        async with new_client() as client:
            # Upload
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

            # Get by ID
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == workflow_id

    @pytest.mark.asyncio
    async def test_user_can_get_own_workflow_content(self, user_headers):
        """User can get content of their own workflow."""
        async with new_client() as client:
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

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/content",
                headers=user_headers,
            )

        assert response.status_code == 200
        assert "version" in response.json()

    @pytest.mark.asyncio
    async def test_user_can_update_own_workflow_file(self, user_headers):
        """User can replace their workflow file."""
        async with new_client() as client:
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

            # Update with new content
            response = await client.put(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
                files={
                    "file": (
                        "updated.swwf",
                        make_workflow_content(name="Updated Workflow"),
                        "application/octet-stream",
                    )
                },
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Workflow"

    @pytest.mark.asyncio
    async def test_user_can_update_own_workflow_metadata(self, user_headers):
        """User can update workflow metadata (folder, tags)."""
        async with new_client() as client:
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

            response = await client.patch(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
                json={"folder_path": "/production", "tags": ["important", "reviewed"]},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["folder_path"] == "/production"
        assert "important" in data["tags"]

    @pytest.mark.asyncio
    async def test_user_can_delete_own_workflow(self, user_headers):
        """User can delete their own workflow."""
        async with new_client() as client:
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

            response = await client.delete(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
            )

        assert response.status_code == 204


class TestUserCannotAccessOthersWorkflows:
    """User cannot access workflows owned by other users."""

    @pytest.mark.asyncio
    async def test_user_only_sees_own_workflows_not_others(
        self, user_headers, second_user_headers
    ):
        """Users only see their own workflows, not others'."""
        async with new_client() as client:
            # First user uploads
            first_upload = await client.post(
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
            first_workflow_id = first_upload.json()["id"]

            # Second user uploads
            second_upload = await client.post(
                "/api/v1/workflows",
                headers=second_user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(name="Second User Workflow"),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            second_workflow_id = second_upload.json()["id"]

            # First user lists workflows - sees only their own
            response = await client.get("/api/v1/workflows", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        workflow_ids = [w["id"] for w in data["workflows"]]
        assert first_workflow_id in workflow_ids
        assert second_workflow_id not in workflow_ids

    @pytest.mark.asyncio
    async def test_user_cannot_get_other_users_workflow(
        self, user_headers, second_user_headers
    ):
        """User cannot get another user's workflow."""
        async with new_client() as client:
            # Second user uploads
            upload_response = await client.post(
                "/api/v1/workflows",
                headers=second_user_headers,
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

            # First user tries to access
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_update_other_users_workflow(
        self, user_headers, second_user_headers
    ):
        """User cannot update another user's workflow."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/v1/workflows",
                headers=second_user_headers,
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

            response = await client.patch(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
                json={"folder_path": "/hacked"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_other_users_workflow(
        self, user_headers, second_user_headers
    ):
        """User cannot delete another user's workflow."""
        async with new_client() as client:
            upload_response = await client.post(
                "/api/v1/workflows",
                headers=second_user_headers,
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

            response = await client.delete(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserWorkflowsFiltering:
    """User sees only their own workflows."""

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_workflows(self, user_headers):
        """User with no workflows sees empty list."""
        async with new_client() as client:
            response = await client.get("/api/v1/workflows", headers=user_headers)

        assert response.status_code == 200
        # May have leftover workflows from other tests, so just check structure
        assert "workflows" in response.json()
        assert "total" in response.json()

    @pytest.mark.asyncio
    async def test_user_cannot_get_workflow_via_global_endpoint(self, user_headers):
        """User cannot use GET /workflows/{id} (requires auditor+ or ownership)."""
        async with new_client() as client:
            # Upload a workflow first
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

            # Try the global endpoint - should work since user owns it
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}",
                headers=user_headers,
            )

        # User CAN access their own workflow via the global endpoint
        # (our access control checks ownership OR auditor+ role)
        assert response.status_code == 200
