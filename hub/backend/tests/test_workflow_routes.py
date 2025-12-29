"""Tests for workflow routes."""

import json
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.database import get_db
from app.db.models import Base
from app.main import app

# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://sigilweaver:sigilweaver@localhost:25802/sigilweaver_hub_test"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    """Override database dependency for tests."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Apply dependency override
app.dependency_overrides[get_db] = override_get_db


def make_workflow_content(
    name: str = "Test Workflow",
    description: str = "A test workflow",
    author: str = "Test Author",
    workflow_id: str = "d7f0101e-6151-46fa-922d-c081146a19c8",
) -> bytes:
    """Create valid workflow file content."""
    return json.dumps({
        "version": "2.0",
        "meta": {
            "name": name,
            "description": description,
            "author": author,
            "workflowId": workflow_id,
            "created": "2025-11-28T01:27:00.041Z",
        },
        "tools": [
            {
                "id": "RLOJUUyx",
                "type": "Input",
                "x": -300,
                "y": 180,
                "config": {"category": "file", "type": "csv"},
                "sockets": [{"id": 0, "direction": "output"}],
            }
        ],
        "wires": [],
    }).encode("utf-8")


@pytest.fixture(scope="function")
async def temp_storage():
    """Create temporary storage for workflow files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Patch the settings to use temp storage
        original = settings.workflow_storage_path
        settings.workflow_storage_path = tmpdir
        yield tmpdir
        settings.workflow_storage_path = original


@pytest.fixture(scope="function")
async def setup_database(temp_storage):
    """Create tables before each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def auth_headers(setup_database):
    """Create an authenticated user and return auth headers."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Create owner user
        response = await client.post(
            "/api/auth/register",
            json={"username": "testuser", "password": "password123"},
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(setup_database):
    """Create test client."""
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )


class TestListWorkflows:
    """Tests for GET /workflows."""

    @pytest.mark.asyncio
    async def test_list_workflows_empty(self, client, auth_headers):
        """List returns empty when no workflows exist."""
        async with client:
            response = await client.get(
                "/api/workflows",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["workflows"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_workflows_requires_auth(self, client):
        """List requires authentication."""
        async with client:
            response = await client.get("/api/workflows")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_workflows_with_data(self, client, auth_headers):
        """List returns uploaded workflows."""
        async with client:
            # Upload a workflow
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )

            response = await client.get(
                "/api/workflows",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["workflows"][0]["name"] == "Test Workflow"


class TestUploadWorkflow:
    """Tests for POST /workflows."""

    @pytest.mark.asyncio
    async def test_upload_workflow_success(self, client, auth_headers):
        """Successfully upload a workflow."""
        async with client:
            response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/projects", "tags": "test,example"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Workflow"
        assert data["message"] == "Workflow uploaded successfully"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_upload_requires_auth(self, client):
        """Upload requires authentication."""
        async with client:
            response = await client.post(
                "/api/workflows",
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_upload_rejects_non_swwf(self, client, auth_headers):
        """Reject files without .swwf extension."""
        async with client:
            response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.json", b'{"test": true}', "application/json")},
            )

        assert response.status_code == 400
        assert "must be a .swwf" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_upload_rejects_empty_file(self, client, auth_headers):
        """Reject empty files."""
        async with client:
            response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", b"", "application/octet-stream")},
            )

        assert response.status_code == 400
        assert "empty" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_upload_rejects_invalid_json(self, client, auth_headers):
        """Reject invalid JSON content."""
        async with client:
            response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", b"not json", "application/octet-stream")},
            )

        assert response.status_code == 400
        assert "Invalid workflow file" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_upload_with_tags(self, client, auth_headers):
        """Upload with tags stores them correctly."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": "tag1,tag2,tag3"},
            )
            workflow_id = upload_response.json()["id"]

            # Get details
            response = await client.get(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert set(data["tags"]) == {"tag1", "tag2", "tag3"}


class TestGetWorkflow:
    """Tests for GET /workflows/{id}."""

    @pytest.mark.asyncio
    async def test_get_workflow_success(self, client, auth_headers):
        """Get workflow metadata by ID."""
        async with client:
            # Upload first
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/projects", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Get details
            response = await client.get(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == workflow_id
        assert data["name"] == "Test Workflow"
        assert data["description"] == "A test workflow"
        assert data["author"] == "Test Author"
        assert data["folder_path"] == "/projects"
        assert data["uploaded_by"] == "testuser"

    @pytest.mark.asyncio
    async def test_get_workflow_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.get(
                "/api/workflows/00000000-0000-0000-0000-000000000000",
                headers=auth_headers,
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_workflow_requires_auth(self, client, setup_database):
        """Get requires authentication."""
        async with client:
            response = await client.get(
                "/api/workflows/00000000-0000-0000-0000-000000000000"
            )

        assert response.status_code == 401


class TestGetWorkflowContent:
    """Tests for GET /workflows/{id}/content."""

    @pytest.mark.asyncio
    async def test_get_content_success(self, client, auth_headers):
        """Get parsed workflow content."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Get content
            response = await client.get(
                f"/api/workflows/{workflow_id}/content",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.0"
        assert data["meta"]["name"] == "Test Workflow"
        assert data["meta"]["workflowId"] == "d7f0101e-6151-46fa-922d-c081146a19c8"
        assert len(data["tools"]) == 1
        assert data["tools"][0]["type"] == "Input"

    @pytest.mark.asyncio
    async def test_get_content_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.get(
                "/api/workflows/00000000-0000-0000-0000-000000000000/content",
                headers=auth_headers,
            )

        assert response.status_code == 404


class TestDownloadWorkflow:
    """Tests for GET /workflows/{id}/download."""

    @pytest.mark.asyncio
    async def test_download_success(self, client, auth_headers):
        """Download original workflow file."""
        content = make_workflow_content()

        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", content, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Download
            response = await client.get(
                f"/api/workflows/{workflow_id}/download",
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.content == content
        assert "attachment" in response.headers["content-disposition"]
        assert "Test Workflow.swwf" in response.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.get(
                "/api/workflows/00000000-0000-0000-0000-000000000000/download",
                headers=auth_headers,
            )

        assert response.status_code == 404


class TestUpdateWorkflowFile:
    """Tests for PUT /workflows/{id}."""

    @pytest.mark.asyncio
    async def test_update_file_success(self, client, auth_headers):
        """Update workflow file."""
        async with client:
            # Upload original
            original_content = make_workflow_content(name="Original")
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", original_content, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]
            original_checksum = None

            # Get original checksum
            get_response = await client.get(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
            )
            original_checksum = get_response.json()["checksum"]

            # Update with new file
            updated_content = make_workflow_content(name="Updated")
            response = await client.put(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
                files={"file": ("updated.swwf", updated_content, "application/octet-stream")},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["checksum"] != original_checksum

    @pytest.mark.asyncio
    async def test_update_file_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.put(
                "/api/workflows/00000000-0000-0000-0000-000000000000",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
            )

        assert response.status_code == 404


class TestUpdateWorkflowMetadata:
    """Tests for PATCH /workflows/{id}."""

    @pytest.mark.asyncio
    async def test_update_metadata_success(self, client, auth_headers):
        """Update workflow metadata without changing file."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": "old"},
            )
            workflow_id = upload_response.json()["id"]

            # Update metadata
            response = await client.patch(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
                json={"folder_path": "/new/path", "tags": ["new", "tags"]},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["folder_path"] == "/new/path"
        assert set(data["tags"]) == {"new", "tags"}

    @pytest.mark.asyncio
    async def test_update_metadata_partial(self, client, auth_headers):
        """Update only some metadata fields."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/original", "tags": "original"},
            )
            workflow_id = upload_response.json()["id"]

            # Update only tags
            response = await client.patch(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
                json={"tags": ["updated"]},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["folder_path"] == "/original"  # Unchanged
        assert data["tags"] == ["updated"]

    @pytest.mark.asyncio
    async def test_update_metadata_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.patch(
                "/api/workflows/00000000-0000-0000-0000-000000000000",
                headers=auth_headers,
                json={"folder_path": "/new"},
            )

        assert response.status_code == 404


class TestDeleteWorkflow:
    """Tests for DELETE /workflows/{id}."""

    @pytest.mark.asyncio
    async def test_delete_success(self, client, auth_headers, temp_storage):
        """Delete workflow and file."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Verify file exists
            file_path = Path(temp_storage) / f"{workflow_id}.swwf"
            assert file_path.exists()

            # Delete
            response = await client.delete(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
            )

        assert response.status_code == 204

        # Verify file deleted
        assert not file_path.exists()

    @pytest.mark.asyncio
    async def test_delete_not_found(self, client, auth_headers):
        """Return 404 for nonexistent workflow."""
        async with client:
            response = await client.delete(
                "/api/workflows/00000000-0000-0000-0000-000000000000",
                headers=auth_headers,
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_removes_from_list(self, client, auth_headers):
        """Deleted workflow not in list."""
        async with client:
            # Upload
            upload_response = await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload_response.json()["id"]

            # Delete
            await client.delete(
                f"/api/workflows/{workflow_id}",
                headers=auth_headers,
            )

            # List
            response = await client.get(
                "/api/workflows",
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["total"] == 0


class TestWorkflowFiltering:
    """Tests for workflow list filtering."""

    @pytest.mark.asyncio
    async def test_filter_by_folder(self, client, auth_headers):
        """Filter workflows by folder path."""
        async with client:
            # Upload to different folders
            content_a = make_workflow_content(name="A")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("a.swwf", content_a, "application/octet-stream")},
                data={"folder_path": "/folder1", "tags": ""},
            )
            content_b = make_workflow_content(name="B")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("b.swwf", content_b, "application/octet-stream")},
                data={"folder_path": "/folder2", "tags": ""},
            )

            # Filter by folder
            response = await client.get(
                "/api/workflows?folder=/folder1",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["workflows"][0]["name"] == "A"

    @pytest.mark.asyncio
    async def test_filter_by_tag(self, client, auth_headers):
        """Filter workflows by tag."""
        async with client:
            # Upload with different tags
            content_a = make_workflow_content(name="A")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("a.swwf", content_a, "application/octet-stream")},
                data={"folder_path": "/", "tags": "important,production"},
            )
            content_b = make_workflow_content(name="B")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("b.swwf", content_b, "application/octet-stream")},
                data={"folder_path": "/", "tags": "draft"},
            )

            # Filter by tag
            response = await client.get(
                "/api/workflows?tag=important",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["workflows"][0]["name"] == "A"

    @pytest.mark.asyncio
    async def test_search_by_name(self, client, auth_headers):
        """Search workflows by name."""
        async with client:
            # Upload workflows
            content_a = make_workflow_content(name="Sales Report")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("a.swwf", content_a, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            content_b = make_workflow_content(name="Inventory Analysis")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("b.swwf", content_b, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )

            # Search
            response = await client.get(
                "/api/workflows?search=sales",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "Sales" in data["workflows"][0]["name"]

    @pytest.mark.asyncio
    async def test_search_by_description(self, client, auth_headers):
        """Search workflows by description."""
        async with client:
            # Upload with specific description
            content_a = make_workflow_content(description="Processes customer data")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("a.swwf", content_a, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )
            content_b = make_workflow_content(name="Other", description="Something else")
            await client.post(
                "/api/workflows",
                headers=auth_headers,
                files={"file": ("b.swwf", content_b, "application/octet-stream")},
                data={"folder_path": "/", "tags": ""},
            )

            # Search
            response = await client.get(
                "/api/workflows?search=customer",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
