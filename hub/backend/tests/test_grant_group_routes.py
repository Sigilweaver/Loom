"""Tests for grant group management routes.

Tests the GrantGroup CRUD operations and assignments.
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


# =============================================================================
# Grant Group CRUD Tests
# =============================================================================


class TestListGrantGroups:
    """Tests for GET /grant-groups"""

    @pytest.mark.asyncio
    async def test_list_grant_groups_requires_auth(self, client):
        """Listing grant groups requires authentication."""
        async with client:
            response = await client.get("/api/v1/grant-groups")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_regular_user_cannot_list_grant_groups(self, client):
        """Regular users cannot list grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_token, _ = await create_user_with_role(client, owner_token, "testuser")

            response = await client.get(
                "/api/v1/grant-groups",
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_can_list_grant_groups(self, client):
        """Auditors can list grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            response = await client.get(
                "/api/v1/grant-groups",
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "grant_groups" in data
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_admin_can_list_grant_groups(self, client):
        """Admins can list grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)

            # Create a grant group
            await create_grant_group(client, owner_token, "Test Grant Group")

            response = await client.get(
                "/api/v1/grant-groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["grant_groups"][0]["name"] == "Test Grant Group"


class TestCreateGrantGroup:
    """Tests for POST /grant-groups"""

    @pytest.mark.asyncio
    async def test_create_grant_group_requires_admin(self, client):
        """Creating grant groups requires admin role."""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )

            response = await client.post(
                "/api/v1/grant-groups",
                json={"name": "New Grant Group"},
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_create_grant_group(self, client):
        """Admins can create grant groups."""
        async with client:
            owner_token, owner_data = await create_owner(client)

            response = await client.post(
                "/api/v1/grant-groups",
                json={"name": "Production Access", "description": "Access to prod"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Production Access"
        assert data["description"] == "Access to prod"
        assert data["connection_count"] == 0
        assert data["user_group_count"] == 0
        assert data["created_by"] == owner_data["username"]

    @pytest.mark.asyncio
    async def test_duplicate_grant_group_name_rejected(self, client):
        """Cannot create grant group with existing name."""
        async with client:
            owner_token, _ = await create_owner(client)

            await create_grant_group(client, owner_token, "Production")

            response = await client.post(
                "/api/v1/grant-groups",
                json={"name": "Production"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_grant_group_name_required(self, client):
        """Grant group name is required."""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.post(
                "/api/v1/grant-groups",
                json={"description": "No name provided"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 422


class TestGetGrantGroup:
    """Tests for GET /grant-groups/{grant_group_id}"""

    @pytest.mark.asyncio
    async def test_get_grant_group_by_id(self, client):
        """Can retrieve grant group by ID."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")

            response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert response.json()["name"] == "Test Group"

    @pytest.mark.asyncio
    async def test_get_nonexistent_grant_group(self, client):
        """Getting nonexistent grant group returns 404."""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.get(
                "/api/v1/grant-groups/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


class TestUpdateGrantGroup:
    """Tests for PATCH /grant-groups/{grant_group_id}"""

    @pytest.mark.asyncio
    async def test_update_grant_group_name(self, client):
        """Can update grant group name."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Old Name")

            response = await client.patch(
                f"/api/v1/grant-groups/{grant_group['id']}",
                json={"name": "New Name"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_update_grant_group_description(self, client):
        """Can update grant group description."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")

            response = await client.patch(
                f"/api/v1/grant-groups/{grant_group['id']}",
                json={"description": "New description"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert response.json()["description"] == "New description"

    @pytest.mark.asyncio
    async def test_update_requires_admin(self, client):
        """Updating grant groups requires admin role."""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )
            grant_group = await create_grant_group(client, owner_token, "Test Group")

            response = await client.patch(
                f"/api/v1/grant-groups/{grant_group['id']}",
                json={"name": "Updated"},
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_to_duplicate_name_rejected(self, client):
        """Cannot update to an existing name."""
        async with client:
            owner_token, _ = await create_owner(client)
            await create_grant_group(client, owner_token, "Existing")
            grant_group = await create_grant_group(client, owner_token, "ToUpdate")

            response = await client.patch(
                f"/api/v1/grant-groups/{grant_group['id']}",
                json={"name": "Existing"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 409


class TestDeleteGrantGroup:
    """Tests for DELETE /grant-groups/{grant_group_id}"""

    @pytest.mark.asyncio
    async def test_delete_grant_group(self, client):
        """Can delete grant group."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "ToDelete")

            response = await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            assert response.status_code == 204

            # Verify deletion
            verify_response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert verify_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_requires_admin(self, client):
        """Deleting grant groups requires admin role."""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )
            grant_group = await create_grant_group(client, owner_token, "Test Group")

            response = await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_nonexistent_grant_group(self, client):
        """Deleting nonexistent grant group returns 404."""
        async with client:
            owner_token, _ = await create_owner(client)

            response = await client.delete(
                "/api/v1/grant-groups/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


# =============================================================================
# Connection Assignment Tests
# =============================================================================


class TestAddConnectionToGrantGroup:
    """Tests for PUT /grant-groups/{id}/connections/{conn_id}"""

    @pytest.mark.asyncio
    async def test_add_connection_to_grant_group(self, client):
        """Can add connection to grant group."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            response = await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_add_connection_requires_admin(self, client):
        """Adding connections to grant groups requires admin role."""
        async with client:
            owner_token, _ = await create_owner(client)
            auditor_token, _ = await create_user_with_role(
                client, owner_token, "auditor", "auditor"
            )
            grant_group = await create_grant_group(client, owner_token, "Test Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            response = await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {auditor_token}"},
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_add_same_connection_twice(self, client):
        """Cannot add same connection to grant group twice."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            # First addition
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Second addition should fail
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_connection_to_nonexistent_grant_group(self, client):
        """Adding connection to nonexistent grant group returns 404."""
        async with client:
            owner_token, _ = await create_owner(client)
            connection = await create_connection(client, owner_token, "Test Connection")

            response = await client.post(
                f"/api/v1/grant-groups/00000000-0000-0000-0000-000000000000/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_nonexistent_connection_to_grant_group(self, client):
        """Adding nonexistent connection to grant group returns 404."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")

            response = await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


class TestRemoveConnectionFromGrantGroup:
    """Tests for DELETE /grant-groups/{id}/connections/{conn_id}"""

    @pytest.mark.asyncio
    async def test_remove_connection_from_grant_group(self, client):
        """Can remove connection from grant group."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            # Add first
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Remove
            response = await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_unassigned_connection_returns_404(self, client):
        """Removing unassigned connection returns 404."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            response = await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 404


# =============================================================================
# Group Endpoint Grant Group Tests
# =============================================================================


class TestListGroupGrantGroups:
    """Tests for GET /groups/{id}/grant-groups"""

    @pytest.mark.asyncio
    async def test_list_group_grant_groups(self, client):
        """Can list grant groups for a user group."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            user_group = await create_user_group(client, owner_token, "Test User Group")

            # Assign grant group to user group via groups endpoint
            await client.post(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            response = await client.get(
                f"/api/v1/groups/{user_group['id']}/grant-groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["grant_groups"][0]["grant_group_name"] == "Test Grant Group"

    @pytest.mark.asyncio
    async def test_list_empty_grant_groups(self, client):
        """Listing grant groups for group with none returns empty list."""
        async with client:
            owner_token, _ = await create_owner(client)
            user_group = await create_user_group(client, owner_token, "Test User Group")

            response = await client.get(
                f"/api/v1/groups/{user_group['id']}/grant-groups",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0


class TestAssignGrantGroupToUserGroup:
    """Tests for PUT /groups/{id}/grant-groups/{grant_group_id}"""

    @pytest.mark.asyncio
    async def test_assign_grant_group_via_groups_endpoint(self, client):
        """Can assign grant group via groups endpoint."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            user_group = await create_user_group(client, owner_token, "Test User Group")

            response = await client.post(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 201


class TestRemoveGrantGroupFromUserGroup:
    """Tests for DELETE /groups/{id}/grant-groups/{grant_group_id}"""

    @pytest.mark.asyncio
    async def test_remove_grant_group_via_groups_endpoint(self, client):
        """Can remove grant group via groups endpoint."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            user_group = await create_user_group(client, owner_token, "Test User Group")

            # Assign first
            await client.post(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Remove
            response = await client.delete(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 204


# =============================================================================
# Cascade Delete Tests
# =============================================================================


class TestGrantGroupCascadeDeletes:
    """Tests for cascade delete behavior."""

    @pytest.mark.asyncio
    async def test_deleting_grant_group_removes_connection_assignments(self, client):
        """Deleting grant group removes its connection assignments."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            # Add connection to grant group
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Delete grant group
            await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Connection should still exist
            response = await client.get(
                f"/api/v1/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_deleting_grant_group_removes_user_group_assignments(self, client):
        """Deleting grant group removes its user group assignments."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            user_group = await create_user_group(client, owner_token, "Test User Group")

            # Assign grant group to user group via groups endpoint
            await client.post(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Delete grant group
            await client.delete(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # User group should still exist
            response = await client.get(
                f"/api/v1/groups/{user_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_deleting_connection_removes_grant_group_assignments(self, client):
        """Deleting connection removes it from grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            connection = await create_connection(client, owner_token, "Test Connection")

            # Add connection to grant group
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Delete connection
            await client.delete(
                f"/api/v1/connections/{connection['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Grant group should still exist with 0 connections
            response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert len(response.json()["connections"]) == 0

    @pytest.mark.asyncio
    async def test_deleting_user_group_removes_grant_group_assignments(self, client):
        """Deleting user group removes it from grant groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            user_group = await create_user_group(client, owner_token, "Test User Group")

            # Assign grant group to user group via groups endpoint
            await client.post(
                f"/api/v1/groups/{user_group['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Delete user group
            await client.delete(
                f"/api/v1/groups/{user_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Grant group should still exist with 0 user groups
            response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        assert len(response.json()["user_groups"]) == 0


# =============================================================================
# Detail Response Tests
# =============================================================================


class TestGrantGroupDetailResponse:
    """Tests for grant group detail response."""

    @pytest.mark.asyncio
    async def test_detail_includes_connections(self, client):
        """Detail response includes assigned connections."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            conn1 = await create_connection(client, owner_token, "Connection 1")
            conn2 = await create_connection(client, owner_token, "Connection 2")

            # Add connections
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{conn1['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            await client.post(
                f"/api/v1/grant-groups/{grant_group['id']}/connections/{conn2['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert len(data["connections"]) == 2
        conn_names = {c["name"] for c in data["connections"]}
        assert conn_names == {"Connection 1", "Connection 2"}

    @pytest.mark.asyncio
    async def test_detail_includes_user_groups(self, client):
        """Detail response includes assigned user groups."""
        async with client:
            owner_token, _ = await create_owner(client)
            grant_group = await create_grant_group(client, owner_token, "Test Grant Group")
            group1 = await create_user_group(client, owner_token, "Group 1")
            group2 = await create_user_group(client, owner_token, "Group 2")

            # Assign grant group to user groups via groups endpoint
            await client.post(
                f"/api/v1/groups/{group1['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            await client.post(
                f"/api/v1/groups/{group2['id']}/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            response = await client.get(
                f"/api/v1/grant-groups/{grant_group['id']}",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert len(data["user_groups"]) == 2
        group_names = {g["user_group_name"] for g in data["user_groups"]}
        assert group_names == {"Group 1", "Group 2"}
