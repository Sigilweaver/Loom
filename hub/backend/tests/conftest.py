"""Shared test fixtures for Hub backend tests.

Provides role-based user fixtures and common test utilities.
All permission tests should use these fixtures to ensure consistency.
"""

import tempfile

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.database import get_db
from app.db.models import Base
from app.main import app

# Test database URL - use a separate test database
TEST_DATABASE_URL = (
    "postgresql+asyncpg://sigilweaver:sigilweaver@localhost:25802/sigilweaver_hub_test"
)

# Create test engine with NullPool for testing (avoids connection issues)
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


def new_client():
    """Create a new test client instance."""
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )


# =============================================================================
# Database Setup
# =============================================================================


@pytest.fixture(scope="function")
async def temp_storage():
    """Create temporary storage for workflow files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        original = settings.workflow_storage_path
        settings.workflow_storage_path = tmpdir
        yield tmpdir
        settings.workflow_storage_path = original


@pytest.fixture(scope="function")
async def setup_database(temp_storage):
    """Create tables before each test and clean up after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Clean up after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client(setup_database):
    """Create test client with database setup."""
    return new_client()


# =============================================================================
# Role-Based User Fixtures
# =============================================================================


@pytest.fixture
async def owner_headers(setup_database) -> dict[str, str]:
    """Create owner user (first registration) and return auth headers."""
    async with new_client() as client:
        response = await client.post(
            "/api/auth/register",
            json={"username": "owner", "password": "password123"},
        )
        assert response.status_code == 201, f"Failed to create owner: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "owner"
        return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture
async def admin_headers(setup_database, owner_headers) -> dict[str, str]:
    """Create admin user and return auth headers."""
    async with new_client() as client:
        # Owner creates admin user
        response = await client.post(
            "/api/auth/users",
            headers=owner_headers,
            json={"username": "admin", "password": "password123", "role": "admin"},
        )
        assert response.status_code == 201, f"Failed to create admin: {response.text}"

        # Login as admin
        response = await client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "password123"},
        )
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def auditor_headers(setup_database, owner_headers) -> dict[str, str]:
    """Create auditor user and return auth headers."""
    async with new_client() as client:
        # Owner creates auditor user
        response = await client.post(
            "/api/auth/users",
            headers=owner_headers,
            json={"username": "auditor", "password": "password123", "role": "auditor"},
        )
        assert response.status_code == 201, f"Failed to create auditor: {response.text}"

        # Login as auditor
        response = await client.post(
            "/api/auth/login",
            json={"username": "auditor", "password": "password123"},
        )
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def user_headers(setup_database, owner_headers) -> dict[str, str]:
    """Create regular user and return auth headers.

    This is the 'user' role that can create/update workflows, schedules, and
    trigger executions. Per roles.md, this is the operational role.
    """
    async with new_client() as client:
        # Owner creates regular user
        response = await client.post(
            "/api/auth/users",
            headers=owner_headers,
            json={"username": "testuser", "password": "password123", "role": "user"},
        )
        assert response.status_code == 201, f"Failed to create user: {response.text}"

        # Login as user
        response = await client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "password123"},
        )
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def second_user_headers(setup_database, owner_headers) -> dict[str, str]:
    """Create a second regular user for ownership boundary testing."""
    async with new_client() as client:
        response = await client.post(
            "/api/auth/users",
            headers=owner_headers,
            json={"username": "otheruser", "password": "password123", "role": "user"},
        )
        assert response.status_code == 201

        response = await client.post(
            "/api/auth/login",
            json={"username": "otheruser", "password": "password123"},
        )
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def second_user_info(second_user_headers) -> dict:
    """Get info for the second user including their ID."""
    async with new_client() as client:
        response = await client.get("/api/auth/me", headers=second_user_headers)
        assert response.status_code == 200
        return response.json()


# =============================================================================
# Resource Fixtures
# =============================================================================


@pytest.fixture
async def test_group(setup_database, owner_headers) -> dict:
    """Create a test group and return its data."""
    async with new_client() as client:
        response = await client.post(
            "/api/groups",
            headers=owner_headers,
            json={"name": "Test Group", "description": "A test group"},
        )
        assert response.status_code == 201
        return response.json()


@pytest.fixture
async def user_in_group(setup_database, owner_headers, user_headers, test_group) -> dict:
    """Add the test user to the test group.

    Returns the user info after being added to the group.
    """
    async with new_client() as client:
        # Get user ID from /me endpoint
        response = await client.get("/api/auth/me", headers=user_headers)
        user_data = response.json()
        user_id = user_data["id"]

        # Add user to group
        response = await client.post(
            f"/api/groups/{test_group['id']}/members",
            headers=owner_headers,
            json={"user_id": user_id},
        )
        assert response.status_code == 201, f"Failed to add user to group: {response.text}"

        return {"user_id": user_id, "group_id": test_group["id"]}


@pytest.fixture
async def test_server(setup_database) -> dict:
    """Register a test server and return its data.

    Note: Server registration doesn't require auth if no secret is configured.
    """
    # Temporarily disable server registration secret for testing
    original_secret = settings.server_registration_secret
    settings.server_registration_secret = ""

    try:
        async with new_client() as client:
            response = await client.post(
                "/api/servers",
                json={
                    "name": "Test Server",
                    "endpoint_url": "http://localhost:58000",
                    "auth_token": "test-token",
                },
            )
            assert response.status_code == 201, f"Server registration failed: {response.text}"
            return response.json()
    finally:
        settings.server_registration_secret = original_secret


@pytest.fixture
async def server_in_group(setup_database, owner_headers, test_server, test_group) -> dict:
    """Assign the test server to the test group."""
    async with new_client() as client:
        response = await client.post(
            f"/api/servers/{test_server['id']}/groups/{test_group['id']}",
            headers=owner_headers,
        )
        assert response.status_code == 201
        return {"server_id": test_server["id"], "group_id": test_group["id"]}


# =============================================================================
# Workflow Helpers
# =============================================================================


def make_workflow_content(
    name: str = "Test Workflow",
    description: str = "A test workflow",
    author: str = "Test Author",
    workflow_id: str = "d7f0101e-6151-46fa-922d-c081146a19c8",
) -> bytes:
    """Create valid workflow file content."""
    import json

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
