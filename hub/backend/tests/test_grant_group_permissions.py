"""Tests for grant group permission access paths.

Tests that users can access connections through the grant group permission path:
User -> User Group -> Grant Group -> Connection

These tests verify:
1. Users get access to connections via grant groups
2. Permission revocation works correctly
3. Both permission paths (legacy and grant groups) work together
"""

import pytest
from httpx import AsyncClient

from tests.conftest import new_client


@pytest.fixture
def client(setup_database):
    """Create test client - uses shared setup_database from conftest."""
    return new_client()


# =============================================================================
# Helper Functions
# =============================================================================


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
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "password123"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    user_data = response.json()["user"]

    if role != "user":
        update_response = await client.patch(
            f"/api/v1/users/{user_data['id']}",
            json={"role": role},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        user_data = update_response.json()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "password123"},
    )
    token = login_response.json()["access_token"]
    return token, user_data


async def create_grant_group(
    client: AsyncClient, admin_token: str, name: str, description: str = ""
) -> dict:
    """Helper: Create a grant group and return its data."""
    response = await client.post(
        "/api/v1/grant-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": name, "description": description},
    )
    assert response.status_code == 201, f"Failed to create grant group: {response.text}"
    return response.json()


async def create_connection(
    client: AsyncClient, admin_token: str, name: str
) -> dict:
    """Helper: Create a connection and return its data.

    Skips test if CONNECTION_ENCRYPTION_KEY is not configured (returns 503).
    """
    response = await client.post(
        "/api/v1/connections",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "type": "database",
            "name": name,
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "test",
            "username": "test",
            "password": "test",
        },
    )
    if response.status_code == 503:
        pytest.skip("CONNECTION_ENCRYPTION_KEY not configured")
    assert response.status_code == 201, f"Failed to create connection: {response.text}"
    return response.json()


async def create_user_group(
    client: AsyncClient, admin_token: str, name: str
) -> dict:
    """Helper: Create a user group and return its data."""
    response = await client.post(
        "/api/v1/groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": name, "description": f"Test group: {name}"},
    )
    assert response.status_code == 201, f"Failed to create user group: {response.text}"
    return response.json()


async def add_user_to_group(
    client: AsyncClient, admin_token: str, group_id: str, user_id: str
) -> None:
    """Helper: Add a user to a user group via /users/{id}/groups endpoint."""
    response = await client.post(
        f"/api/v1/users/{user_id}/groups/{group_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, f"Failed to add user to group: {response.text}"


async def assign_grant_group_to_user_group(
    client: AsyncClient, admin_token: str, grant_group_id: str, user_group_id: str
) -> None:
    """Helper: Assign a grant group to a user group via groups endpoint."""
    response = await client.post(
        f"/api/v1/groups/{user_group_id}/grant-groups/{grant_group_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, f"Failed to assign grant group: {response.text}"


async def add_connection_to_grant_group(
    client: AsyncClient, admin_token: str, grant_group_id: str, connection_id: str
) -> None:
    """Helper: Add a connection to a grant group."""
    response = await client.post(
        f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, f"Failed to add connection to grant group: {response.text}"


# =============================================================================
# User Access via Grant Groups Tests
# =============================================================================


class TestUserAccessViaGrantGroups:
    """Tests for user access to connections via grant groups."""

    @pytest.mark.asyncio
    async def test_user_can_list_connections_via_grant_group(self, client):
        """User in a group with grant group can list connections from that grant group."""
        async with client:
            # Setup: owner creates all resources
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create resources
            connection = await create_connection(client, owner_token, "DB Connection")
            grant_group = await create_grant_group(client, owner_token, "DB Access")
            user_group = await create_user_group(client, owner_token, "Developers")

            # Wire up the permission path:
            # User -> User Group -> Grant Group -> Connection
            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], connection["id"]
            )

            # User should see the connection
            response = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["connections"][0]["name"] == "DB Connection"

    @pytest.mark.asyncio
    async def test_user_cannot_see_unassigned_connections(self, client):
        """User cannot see connections not assigned to their grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create resources
            conn_assigned = await create_connection(client, owner_token, "Assigned")
            await create_connection(client, owner_token, "Unassigned")
            grant_group = await create_grant_group(client, owner_token, "Limited Access")
            user_group = await create_user_group(client, owner_token, "Team")

            # Wire up permission for only one connection
            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], conn_assigned["id"]
            )
            # Note: conn_unassigned is NOT added to grant group

            # User should only see assigned connection
            response = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["connections"][0]["name"] == "Assigned"

    @pytest.mark.asyncio
    async def test_user_with_multiple_grant_groups(self, client):
        """User in group with multiple grant groups sees connections from all."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create resources
            conn1 = await create_connection(client, owner_token, "Prod DB")
            conn2 = await create_connection(client, owner_token, "Staging DB")
            grant_group1 = await create_grant_group(client, owner_token, "Prod Access")
            grant_group2 = await create_grant_group(client, owner_token, "Staging Access")
            user_group = await create_user_group(client, owner_token, "Full Team")

            # Wire up both grant groups to user group
            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group1["id"], user_group["id"]
            )
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group2["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group1["id"], conn1["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group2["id"], conn2["id"]
            )

            # User should see both connections
            response = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        conn_names = {c["name"] for c in data["connections"]}
        assert conn_names == {"Prod DB", "Staging DB"}

    @pytest.mark.asyncio
    async def test_user_in_multiple_groups_with_grant_groups(self, client):
        """User in multiple groups sees connections from all their grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Create resources
            conn1 = await create_connection(client, owner_token, "Team A DB")
            conn2 = await create_connection(client, owner_token, "Team B DB")
            grant_group1 = await create_grant_group(client, owner_token, "Team A Access")
            grant_group2 = await create_grant_group(client, owner_token, "Team B Access")
            user_group1 = await create_user_group(client, owner_token, "Team A")
            user_group2 = await create_user_group(client, owner_token, "Team B")

            # User is in both groups, each with different grant groups
            await add_user_to_group(client, owner_token, user_group1["id"], user_data["id"])
            await add_user_to_group(client, owner_token, user_group2["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group1["id"], user_group1["id"]
            )
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group2["id"], user_group2["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group1["id"], conn1["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group2["id"], conn2["id"]
            )

            # User should see connections from both groups' grant groups
            response = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        conn_names = {c["name"] for c in data["connections"]}
        assert conn_names == {"Team A DB", "Team B DB"}


# =============================================================================
# Permission Revocation Tests
# =============================================================================


class TestGrantGroupPermissionRevocation:
    """Tests for permission revocation via grant groups."""

    @pytest.mark.asyncio
    async def test_removing_grant_group_from_user_group_revokes_access(self, client):
        """Removing grant group from user group revokes user access."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Setup access path
            connection = await create_connection(client, owner_token, "DB Connection")
            grant_group = await create_grant_group(client, owner_token, "DB Access")
            user_group = await create_user_group(client, owner_token, "Developers")

            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], connection["id"]
            )

            # Verify initial access
            response1 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert response1.status_code == 200
            assert response1.json()["total"] == 1

            # Remove grant group from user group via groups endpoint
            await client.delete(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Access should be revoked
            response2 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response2.status_code == 200
        assert response2.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_removing_connection_from_grant_group_revokes_access(self, client):
        """Removing connection from grant group revokes user access to that connection."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Setup access path
            connection = await create_connection(client, owner_token, "DB Connection")
            grant_group = await create_grant_group(client, owner_token, "DB Access")
            user_group = await create_user_group(client, owner_token, "Developers")

            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], connection["id"]
            )

            # Verify initial access
            response1 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert response1.status_code == 200
            assert response1.json()["total"] == 1

            # Remove connection from grant group
            await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Access should be revoked
            response2 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response2.status_code == 200
        assert response2.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_removing_user_from_group_revokes_grant_group_access(self, client):
        """Removing user from group revokes access via that group's grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, user_data = await create_user_with_role(
                client, owner_token, "testuser"
            )

            # Setup access path
            connection = await create_connection(client, owner_token, "DB Connection")
            grant_group = await create_grant_group(client, owner_token, "DB Access")
            user_group = await create_user_group(client, owner_token, "Developers")

            await add_user_to_group(client, owner_token, user_group["id"], user_data["id"])
            await assign_grant_group_to_user_group(
                client, owner_token, grant_group["id"], user_group["id"]
            )
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], connection["id"]
            )

            # Verify initial access
            response1 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert response1.status_code == 200
            assert response1.json()["total"] == 1

            # Remove user from group via /users endpoint
            await client.delete(
                f"/api/v1/users/{user_data['id']}/groups/{user_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Access should be revoked
            response2 = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response2.status_code == 200
        assert response2.json()["total"] == 0


# =============================================================================
# Admin Access Tests
# =============================================================================


class TestAdminAccessUnaffected:
    """Tests that admin access is unaffected by grant group structure."""

    @pytest.mark.asyncio
    async def test_admin_sees_all_connections_regardless_of_grant_groups(self, client):
        """Admins see all connections regardless of grant group assignments."""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create connections
            conn1 = await create_connection(client, owner_token, "Assigned Conn")
            await create_connection(client, owner_token, "Unassigned Conn")

            # Only assign one to a grant group
            grant_group = await create_grant_group(client, owner_token, "Partial")
            await add_connection_to_grant_group(
                client, owner_token, grant_group["id"], conn1["id"]
            )

            # Admin should see all connections
            response = await client.get(
                "/api/v1/connections",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        conn_names = {c["name"] for c in data["connections"]}
        assert conn_names == {"Assigned Conn", "Unassigned Conn"}
