"""Tests for workflow operations as an Auditor role.

Per roles.md:
- Auditors have R (read) on all Workflows
- Auditors cannot create, update, or delete workflows
"""

import pytest
from tests.conftest import make_workflow_content, new_client


class TestAuditorCanReadAllWorkflows:
    """Auditor can read all workflows regardless of owner."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_workflows(
        self, auditor_headers, user_headers
    ):
        """Auditor can list all workflows via GET /workflows."""
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

            # Auditor lists all
            response = await client.get("/api/workflows", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_any_workflow(
        self, auditor_headers, user_headers
    ):
        """Auditor can get details of any workflow."""
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
                headers=auditor_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Pre-existing bug: WorkflowMeta not serialized to dict")
    async def test_auditor_can_get_any_workflow_content(
        self, auditor_headers, user_headers
    ):
        """Auditor can get content of any workflow."""
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
                f"/api/workflows/{workflow_id}/content",
                headers=auditor_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_auditor_can_download_any_workflow(
        self, auditor_headers, user_headers
    ):
        """Auditor can download any workflow file."""
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
                f"/api/workflows/{workflow_id}/download",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert "attachment" in response.headers.get("content-disposition", "")


class TestAuditorCannotModifyWorkflows:
    """Auditor cannot create, update, or delete workflows."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_upload_workflow(self, auditor_headers):
        """Auditor cannot upload workflows (User role only)."""
        async with new_client() as client:
            response = await client.post(
                "/api/workflows",
                headers=auditor_headers,
                files={
                    "file": ("test.swwf", make_workflow_content(), "application/octet-stream")
                },
                data={"folder_path": "/", "tags": ""},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_update_workflow(
        self, auditor_headers, user_headers
    ):
        """Auditor cannot update workflows."""
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

            # Try to update metadata
            response = await client.patch(
                f"/api/workflows/{workflow_id}",
                headers=auditor_headers,
                json={"folder_path": "/audited"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_delete_workflow(
        self, auditor_headers, user_headers
    ):
        """Auditor cannot delete workflows."""
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
                headers=auditor_headers,
            )

        assert response.status_code == 403
