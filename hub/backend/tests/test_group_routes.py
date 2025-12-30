"""Tests for group management routes"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.database import get_db
from app.db.models import Base
from app.main import app

# Test database URL - use a separate test database
TEST_DATABASE_URL = "postgresql+asyncpg://sigilweaver:sigilweaver@localhost:25802/sigilweaver_hub_test"

# Create test engine with NullPool for testing
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
    """Override database dependency for tests"""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Apply dependency override
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
async def setup_database():
    """Create tables before each test and clean up after"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client(setup_database):
    """Create test client with database setup"""
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )


async def create_owner(client: AsyncClient) -> tuple[str, dict]:
    """Helper: Create owner user and return (token, user_data)"""
    response = await client.post(
        "/api/auth/register",
        json={"username": "owner", "password": "password123"},
    )
    data = response.json()
    return data["access_token"], data["user"]


async def create_user_with_role(
    client: AsyncClient, owner_token: str, username: str, role: str = "user"
) -> tuple[str, dict]:
    """Helper: Create user with specified role and return (token, user_data)"""
    # Register the user
    response = await client.post(
        "/api/auth/register",
        json={"username": username, "password": "password123"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    user_data = response.json()["user"]

    # Update role if not default
    if role != "user":
        update_response = await client.patch(
            f"/api/auth/users/{user_data['id']}",
            json={"role": role},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        user_data = update_response.json()

    # Login to get token
    login_response = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "password123"},
    )
    token = login_response.json()["access_token"]

    return token, user_data


# =============================================================================
# Group CRUD Tests
# =============================================================================


class TestListGroups:
    """Tests for GET /groups"""

    @pytest.mark.asyncio
    async def test_list_groups_requires_auth(self, client):
        """Listing groups requires authentication"""
        async with client:
            response = await client.get("/api/groups")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_regular_user_cannot_list_groups(self, client):
        """Regular users cannot list groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, _ = await create_user_with_role(client, owner_token, "testuser")

            response = await client.get(
                "/api/groups",
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_can_list_groups(self, client):
        """Auditors can list groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            response = await client.get(
                "/api/groups",
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_admin_can_list_groups(self, client):
        """Admins can list groups"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create a group first
            await client.post(
                "/api/groups",
                json={"name": "Test Group", "description": "A test group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            response = await client.get(
                "/api/groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["groups"][0]["name"] == "Test Group"


class TestCreateGroup:
    """Tests for POST /groups"""

    @pytest.mark.asyncio
    async def test_create_group_requires_admin(self, client):
        """Creating groups requires admin role"""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            response = await client.post(
                "/api/groups",
                json={"name": "New Group"},
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_create_group(self, client):
        """Admins can create groups"""
        async with client:
            owner_token, owner_data = await create_owner(client)

            response = await client.post(
                "/api/groups",
                json={"name": "Engineering", "description": "Engineering team"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Engineering"
        assert data["description"] == "Engineering team"
        assert data["member_count"] == 0
        assert data["connection_count"] == 0
        assert data["created_by"] == owner_data["username"]

    @pytest.mark.asyncio
    async def test_duplicate_group_name_rejected(self, client):
        """Cannot create group with existing name"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create first group
            await client.post(
                "/api/groups",
                json={"name": "Engineering"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Try to create duplicate
            response = await client.post(
                "/api/groups",
                json={"name": "Engineering"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_group_name_required(self, client):
        """Group name is required"""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.post(
                "/api/groups",
                json={"description": "No name provided"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 422


class TestGetGroup:
    """Tests for GET /groups/{group_id}"""

    @pytest.mark.asyncio
    async def test_get_group_by_id(self, client):
        """Can retrieve group by ID"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Get group
            response = await client.get(
                f"/api/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert response.json()["name"] == "Test Group"

    @pytest.mark.asyncio
    async def test_get_nonexistent_group(self, client):
        """Getting nonexistent group returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.get(
                "/api/groups/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


class TestUpdateGroup:
    """Tests for PATCH /groups/{group_id}"""

    @pytest.mark.asyncio
    async def test_update_group_name(self, client):
        """Can update group name"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Old Name"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Update name
            response = await client.patch(
                f"/api/groups/{group_id}",
                json={"name": "New Name"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_update_requires_admin(self, client):
        """Updating groups requires admin role"""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            # Create group as owner
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to update as auditor
            response = await client.patch(
                f"/api/groups/{group_id}",
                json={"name": "Updated Name"},
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403


class TestDeleteGroup:
    """Tests for DELETE /groups/{group_id}"""

    @pytest.mark.asyncio
    async def test_delete_group(self, client):
        """Can delete a group"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "To Delete"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Delete group
            response = await client.delete(
                f"/api/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent_group(self, client):
        """Deleting nonexistent group returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.delete(
                "/api/groups/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


# =============================================================================
# Group Members Tests
# =============================================================================


class TestListGroupMembers:
    """Tests for GET /groups/{group_id}/members"""

    @pytest.mark.asyncio
    async def test_list_empty_members(self, client):
        """New group has no members"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Empty Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # List members
            response = await client.get(
                f"/api/groups/{group_id}/members",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["members"] == []
        assert data["total"] == 0


class TestAddGroupMember:
    """Tests for POST /groups/{group_id}/members"""

    @pytest.mark.asyncio
    async def test_add_regular_user_to_group(self, client):
        """Can add regular users to groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Add user to group
            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201
        assert response.json()["status"] == "added"

    @pytest.mark.asyncio
    async def test_cannot_add_owner_to_group(self, client):
        """Cannot add owner to groups"""
        async with client:
            owner_token, owner_data = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add owner to group
            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": owner_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Admin-level users" in response.json()["detail"]
        assert "owner" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cannot_add_admin_to_group(self, client):
        """Cannot add admin to groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, admin_data = await create_user_with_role(
                client, owner_token, "testadmin", "admin"
            )

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add admin to group
            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": admin_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Admin-level users" in response.json()["detail"]
        assert "admin" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cannot_add_auditor_to_group(self, client):
        """Cannot add auditor to groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, auditor_data = await create_user_with_role(
                client, owner_token, "testauditor", "auditor"
            )

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add auditor to group
            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": auditor_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Admin-level users" in response.json()["detail"]
        assert "auditor" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cannot_add_same_user_twice(self, client):
        """Cannot add same user to group twice"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Add user first time
            await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Try to add again
            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 409
        assert "already a member" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_add_member_to_nonexistent_group(self, client):
        """Adding member to nonexistent group returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            response = await client.post(
                "/api/groups/00000000-0000-0000-0000-000000000000/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_nonexistent_user_to_group(self, client):
        """Adding nonexistent user to group returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            response = await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": "00000000-0000-0000-0000-000000000000"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


class TestRemoveGroupMember:
    """Tests for DELETE /groups/{group_id}/members/{user_id}"""

    @pytest.mark.asyncio
    async def test_remove_member_from_group(self, client):
        """Can remove member from group"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group and add member
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            await client.post(
                f"/api/groups/{group_id}/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Remove member
            response = await client.delete(
                f"/api/groups/{group_id}/members/{user_data['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_nonmember_returns_404(self, client):
        """Removing non-member returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group (without adding member)
            create_response = await client.post(
                "/api/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to remove
            response = await client.delete(
                f"/api/groups/{group_id}/members/{user_data['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


# =============================================================================
# User's Groups Tests
# =============================================================================


class TestListMyGroups:
    """Tests for GET /groups/my"""

    @pytest.mark.asyncio
    async def test_user_sees_own_groups(self, client):
        """Users can see groups they belong to"""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create two groups
            group1_response = await client.post(
                "/api/groups",
                json={"name": "Group One"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group1_id = group1_response.json()["id"]

            await client.post(
                "/api/groups",
                json={"name": "Group Two"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Add user to only Group One
            await client.post(
                f"/api/groups/{group1_id}/members",
                json={"user_id": user_data["id"]},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # User should only see Group One
            response = await client.get(
                "/api/groups/my",
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["groups"][0]["name"] == "Group One"

    @pytest.mark.asyncio
    async def test_user_with_no_groups(self, client):
        """Users with no groups see empty list"""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, _ = await create_user_with_role(client, owner_token, "testuser")

            response = await client.get(
                "/api/groups/my",
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["groups"] == []
