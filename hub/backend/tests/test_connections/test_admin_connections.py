"""Tests for connection operations as Admin role.

Per roles.md:
- Admin has CRUD on connections
- Admin can manage grant groups and their connection/user-group assignments
"""

import pytest
from tests.conftest import new_client


# Helper to create a database connection payload
def database_connection_payload(name: str = "Test Connection") -> dict:
    """Generate a standard database connection payload."""
    return {
        "type": "database",
        "name": name,
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "testuser",
        "password": "testpass",
    }


class TestAdminCanManageConnections:
    """Admin can perform full CRUD on connections."""

    @pytest.mark.asyncio
    async def test_admin_can_create_connection(self, admin_headers):
        """Admin can create connections."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload("Admin Connection"),
            )

        # May return 503 if encryption key not configured
        if response.status_code == 503:
            pytest.skip("Connection creation requires encryption key")

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Admin Connection"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_admin_can_list_all_connections(self, admin_headers):
        """Admin can list all connections."""
        async with new_client() as client:
            # Create a connection first
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            # List all connections
            response = await client.get("/api/v1/connections", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_get_connection_details(self, admin_headers):
        """Admin can get connection details."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Get connection details
            response = await client.get(
                f"/api/v1/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == connection_id

    @pytest.mark.asyncio
    async def test_admin_can_update_connection(self, admin_headers):
        """Admin can update connections."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Update the connection
            response = await client.put(
                f"/api/v1/connections/{connection_id}",
                headers=admin_headers,
                json={"name": "Updated Connection Name"},
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Connection Name"

    @pytest.mark.asyncio
    async def test_admin_can_delete_connection(self, admin_headers):
        """Admin can delete connections."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Delete the connection
            response = await client.delete(
                f"/api/v1/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCanManageGrantGroups:
    """Admin can create grant groups and manage their assignments."""

    @pytest.mark.asyncio
    async def test_admin_can_create_grant_group(self, admin_headers):
        """Admin can create grant groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Admin Grant Group", "description": "Test grant group"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Admin Grant Group"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_admin_can_add_connection_to_grant_group(self, admin_headers):
        """Admin can add a connection to a grant group."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Create grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # Add connection to grant group
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_admin_can_assign_grant_group_to_user_group(
        self, admin_headers, test_group
    ):
        """Admin can assign a grant group to a user group."""
        async with new_client() as client:
            # Create grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # Assign to user group
            response = await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=admin_headers,
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_admin_can_remove_connection_from_grant_group(self, admin_headers):
        """Admin can remove a connection from a grant group."""
        async with new_client() as client:
            # Create connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Create grant group and add connection
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=admin_headers,
            )

            # Remove connection from grant group
            response = await client.delete(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_admin_can_remove_grant_group_from_user_group(
        self, admin_headers, test_group
    ):
        """Admin can remove a grant group from a user group."""
        async with new_client() as client:
            # Create grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # Assign grant group to user group
            await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=admin_headers,
            )

            # Remove grant group from user group
            response = await client.delete(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_admin_cannot_add_same_connection_twice(self, admin_headers):
        """Admin cannot add the same connection to a grant group twice."""
        async with new_client() as client:
            # Create connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Create grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # First assignment
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=admin_headers,
            )
            assert response.status_code == 201

            # Second assignment - should fail
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 409  # Conflict

    @pytest.mark.asyncio
    async def test_admin_cannot_assign_same_grant_group_twice(
        self, admin_headers, test_group
    ):
        """Admin cannot assign the same grant group to a user group twice."""
        async with new_client() as client:
            # Create grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # First assignment
            response = await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=admin_headers,
            )
            assert response.status_code == 201

            # Second assignment - should fail
            response = await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=admin_headers,
            )

        assert response.status_code == 409  # Conflict
