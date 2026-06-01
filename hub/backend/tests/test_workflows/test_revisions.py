"""Tests for workflow revision history (B5).

Covers append-only revision recording on upload and update, listing,
per-revision download, unified diffs, rollback, and access control.
"""

import pytest

from tests.conftest import make_workflow_content, new_client


async def _upload(client, headers, *, name="Test Workflow", message=""):
    """Upload a workflow and return its id."""
    response = await client.post(
        "/api/v1/workflows",
        headers=headers,
        files={
            "file": (
                "test.swwf",
                make_workflow_content(name=name),
                "application/octet-stream",
            )
        },
        data={"folder_path": "/", "tags": "", "message": message},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _put(client, headers, workflow_id, *, name, message=""):
    """Replace a workflow's file and return the response."""
    return await client.put(
        f"/api/v1/workflows/{workflow_id}",
        headers=headers,
        files={
            "file": (
                "test.swwf",
                make_workflow_content(name=name),
                "application/octet-stream",
            )
        },
        data={"message": message},
    )


class TestRevisionRecording:
    """Each save appends a revision."""

    @pytest.mark.asyncio
    async def test_upload_creates_initial_revision(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers, message="first")

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions",
                headers=user_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        rev = data["revisions"][0]
        assert rev["revision_number"] == 1
        assert rev["parent_revision_id"] is None
        assert rev["author"] == "testuser"
        assert rev["message"] == "first"
        assert rev["size_bytes"] > 0
        assert len(rev["checksum"]) == 64

    @pytest.mark.asyncio
    async def test_update_appends_revision_with_parent(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)

            put = await _put(
                client, user_headers, workflow_id, name="Renamed", message="second"
            )
            assert put.status_code == 200

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions",
                headers=user_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        # Newest first.
        newest, oldest = data["revisions"]
        assert newest["revision_number"] == 2
        assert oldest["revision_number"] == 1
        assert newest["parent_revision_id"] == oldest["id"]
        assert newest["message"] == "second"


class TestRevisionDownload:
    """A specific revision's bytes can be retrieved."""

    @pytest.mark.asyncio
    async def test_download_revision_returns_original_bytes(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers, name="Original")
            await _put(client, user_headers, workflow_id, name="Changed")

            revisions = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()["revisions"]
            first_rev = next(r for r in revisions if r["revision_number"] == 1)

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions/{first_rev['id']}/download",
                headers=user_headers,
            )

        assert response.status_code == 200
        assert response.content == make_workflow_content(name="Original")

    @pytest.mark.asyncio
    async def test_download_unknown_revision_404(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions/"
                "00000000-0000-0000-0000-000000000000/download",
                headers=user_headers,
            )
        assert response.status_code == 404


class TestRevisionDiff:
    """Diffs between revisions are produced as unified text."""

    @pytest.mark.asyncio
    async def test_diff_between_revisions_is_nonempty(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers, name="Alpha")
            await _put(client, user_headers, workflow_id, name="Bravo")

            revisions = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()["revisions"]
            r1 = next(r for r in revisions if r["revision_number"] == 1)["id"]
            r2 = next(r for r in revisions if r["revision_number"] == 2)["id"]

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/diff",
                params={"from": r1, "to": r2},
                headers=user_headers,
            )

        assert response.status_code == 200
        body = response.text
        assert "-" in body and "+" in body
        assert "Alpha" in body
        assert "Bravo" in body

    @pytest.mark.asyncio
    async def test_diff_unknown_revision_404(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            revisions = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()["revisions"]
            r1 = revisions[0]["id"]

            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/diff",
                params={"from": r1, "to": "00000000-0000-0000-0000-000000000000"},
                headers=user_headers,
            )
        assert response.status_code == 404


class TestRollback:
    """Rollback restores prior content and appends a new revision."""

    @pytest.mark.asyncio
    async def test_rollback_restores_content_and_appends_revision(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers, name="V1")
            await _put(client, user_headers, workflow_id, name="V2")

            revisions = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()["revisions"]
            first_rev = next(r for r in revisions if r["revision_number"] == 1)["id"]

            rollback = await client.post(
                f"/api/v1/workflows/{workflow_id}/revisions/{first_rev}/rollback",
                headers=user_headers,
                json={"message": "back to v1"},
            )
            assert rollback.status_code == 200, rollback.text
            assert rollback.json()["name"] == "V1"

            # A third revision now exists recording the rollback.
            revisions_after = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()
            assert revisions_after["total"] == 3
            newest = revisions_after["revisions"][0]
            assert newest["revision_number"] == 3
            assert newest["message"] == "back to v1"

            # Current download reflects rolled-back content.
            download = await client.get(
                f"/api/v1/workflows/{workflow_id}/download",
                headers=user_headers,
            )
            assert download.content == make_workflow_content(name="V1")

    @pytest.mark.asyncio
    async def test_rollback_unknown_revision_404(self, user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            response = await client.post(
                f"/api/v1/workflows/{workflow_id}/revisions/"
                "00000000-0000-0000-0000-000000000000/rollback",
                headers=user_headers,
                json={},
            )
        assert response.status_code == 404


class TestRevisionAccessControl:
    """Owner and auditors can read history; other users cannot; rollback is owner-only."""

    @pytest.mark.asyncio
    async def test_other_user_cannot_list_revisions(
        self, user_headers, second_user_headers
    ):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions",
                headers=second_user_headers,
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_can_list_revisions(self, user_headers, auditor_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            response = await client.get(
                f"/api/v1/workflows/{workflow_id}/revisions",
                headers=auditor_headers,
            )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_other_user_cannot_rollback(self, user_headers, second_user_headers):
        async with new_client() as client:
            workflow_id = await _upload(client, user_headers)
            revisions = (
                await client.get(
                    f"/api/v1/workflows/{workflow_id}/revisions",
                    headers=user_headers,
                )
            ).json()["revisions"]
            rev_id = revisions[0]["id"]

            response = await client.post(
                f"/api/v1/workflows/{workflow_id}/revisions/{rev_id}/rollback",
                headers=second_user_headers,
                json={},
            )
        assert response.status_code == 403
