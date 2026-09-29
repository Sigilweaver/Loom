"""Tests for group management routes"""

import pytest
from httpx import AsyncClient

from tests.conftest import new_client


@pytest.fixture
def client(setup_database):
    """Create test client - uses shared setup_database from conftest."""
    return new_client()


async def create_owner(client: AsyncClient) -> tuple[str, dict]:
    """Helper: Create owner user and return (token, user_data)"""
    response = await client.post(
        "/api/v1/auth/register",
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
        "/api/v1/auth/register",
        json={"username": username, "password": "password123"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    user_data = response.json()["user"]

    # Update role if not default
    if role != "user":
        update_response = await client.patch(
            f"/api/v1/users/{user_data['id']}",
            json={"role": role},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        user_data = update_response.json()

    # Login to get token
    login_response = await client.post(
        "/api/v1/auth/login",
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
            response = await client.get("/api/v1/groups")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_regular_user_sees_only_own_groups(self, client):
        """Regular users see only groups they belong to (empty if none)."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, _ = await create_user_with_role(client, owner_token, "testuser")

            response = await client.get(
                "/api/v1/groups",
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        # User is not in any groups, so sees empty list
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_auditor_can_list_groups(self, client):
        """Auditors can list groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            response = await client.get(
                "/api/v1/groups",
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
                "/api/v1/groups",
                json={"name": "Test Group", "description": "A test group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            response = await client.get(
                "/api/v1/groups",
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
                "/api/v1/groups",
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
                "/api/v1/groups",
                json={"name": "Engineering", "description": "Engineering team"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Engineering"
        assert data["description"] == "Engineering team"
        assert data["member_count"] == 0
        assert data["grant_group_count"] == 0
        assert data["created_by"] == owner_data["username"]

    @pytest.mark.asyncio
    async def test_duplicate_group_name_rejected(self, client):
        """Cannot create group with existing name"""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create first group
            await client.post(
                "/api/v1/groups",
                json={"name": "Engineering"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Try to create duplicate
            response = await client.post(
                "/api/v1/groups",
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
                "/api/v1/groups",
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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Get group
            response = await client.get(
                f"/api/v1/groups/{group_id}",
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
                "/api/v1/groups/00000000-0000-0000-0000-000000000000",
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
                "/api/v1/groups",
                json={"name": "Old Name"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Update name
            response = await client.patch(
                f"/api/v1/groups/{group_id}",
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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to update as auditor
            response = await client.patch(
                f"/api/v1/groups/{group_id}",
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
                "/api/v1/groups",
                json={"name": "To Delete"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Delete group
            response = await client.delete(
                f"/api/v1/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent_group(self, client):
        """Deleting nonexistent group returns 404"""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.delete(
                "/api/v1/groups/00000000-0000-0000-0000-000000000000",
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
                "/api/v1/groups",
                json={"name": "Empty Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # List members
            response = await client.get(
                f"/api/v1/groups/{group_id}/members",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["members"] == []
        assert data["total"] == 0


class TestAddGroupMember:
    """Tests for POST /users/{user_id}/groups/{group_id}"""

    @pytest.mark.asyncio
    async def test_add_regular_user_to_group(self, client):
        """Can add regular users to groups"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group
            create_response = await client.post(
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Add user to group
            response = await client.post(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201
        assert response.json()["message"] == "User added to group"

    @pytest.mark.asyncio
    async def test_cannot_add_owner_to_group(self, client):
        """Cannot add owner to groups"""
        async with client:
            owner_token, owner_data = await create_owner(client)

            # Create group
            create_response = await client.post(
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add owner to group
            response = await client.post(
                f"/api/v1/users/{owner_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Cannot add owner" in response.json()["detail"]

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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add admin to group
            response = await client.post(
                f"/api/v1/users/{admin_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Cannot add admin" in response.json()["detail"]

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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to add auditor to group
            response = await client.post(
                f"/api/v1/users/{auditor_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 400
        assert "Cannot add auditor" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cannot_add_same_user_twice(self, client):
        """Cannot add same user to group twice"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group
            create_response = await client.post(
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Add user first time
            await client.post(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Try to add again
            response = await client.post(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
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
                f"/api/v1/users/{user_data['id']}/groups/00000000-0000-0000-0000-000000000000",
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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            response = await client.post(
                f"/api/v1/users/00000000-0000-0000-0000-000000000000/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


class TestRemoveGroupMember:
    """Tests for DELETE /users/{user_id}/groups/{group_id}"""

    @pytest.mark.asyncio
    async def test_remove_member_from_group(self, client):
        """Can remove member from group"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            # Create group and add member
            create_response = await client.post(
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            await client.post(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Remove member
            response = await client.delete(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
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
                "/api/v1/groups",
                json={"name": "Test Group"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group_id = create_response.json()["id"]

            # Try to remove
            response = await client.delete(
                f"/api/v1/users/{user_data['id']}/groups/{group_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


# =============================================================================
# User's Groups Tests
# =============================================================================


class TestListUserGroups:
    """Tests for GET /users/{user_id}/groups"""

    @pytest.mark.asyncio
    async def test_admin_can_see_user_groups(self, client):
        """Admin can see groups a user belongs to"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create two groups
            group1_response = await client.post(
                "/api/v1/groups",
                json={"name": "Group One"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            group1_id = group1_response.json()["id"]

            await client.post(
                "/api/v1/groups",
                json={"name": "Group Two"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Add user to only Group One
            await client.post(
                f"/api/v1/users/{user_data['id']}/groups/{group1_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Admin should see user belongs to Group One
            response = await client.get(
                f"/api/v1/users/{user_data['id']}/groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["groups"][0]["name"] == "Group One"

    @pytest.mark.asyncio
    async def test_user_with_no_groups(self, client):
        """User with no groups shows empty list"""
        async with client:
            owner_token, _ = await create_owner(client)
            _, user_data = await create_user_with_role(client, owner_token, "testuser")

            response = await client.get(
                f"/api/v1/users/{user_data['id']}/groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["groups"] == []
