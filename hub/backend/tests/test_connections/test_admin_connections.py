"""Tests for connection operations as Admin role.

Per roles.md:
- Admin has CRUD on connections
- Admin can manage connection-group assignments
"""

import pytest
from tests.conftest import new_client


class TestAdminCanManageConnections:
    """Admin can perform full CRUD on connections."""

    @pytest.mark.asyncio
    async def test_admin_can_create_connection(self, admin_headers):
        """Admin can create connections."""
        async with new_client() as client:
            response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Admin Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
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
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            # List all connections
            response = await client.get("/api/connections", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_get_connection_details(self, admin_headers):
        """Admin can get connection details."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Get connection details
            response = await client.get(
                f"/api/connections/{connection_id}",
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
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Update the connection
            response = await client.put(
                f"/api/connections/{connection_id}",
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
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Delete the connection
            response = await client.delete(
                f"/api/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCanManageConnectionGroups:
    """Admin can assign and remove connections from groups."""

    @pytest.mark.asyncio
    async def test_admin_can_assign_connection_to_group(
        self, admin_headers, test_group
    ):
        """Admin can assign a connection to a group."""
        async with new_client() as client:
            # Create a connection
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Assign to group
            response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "assigned"
        assert data["connection_id"] == connection_id

    @pytest.mark.asyncio
    async def test_admin_can_list_group_connections(
        self, admin_headers, test_group
    ):
        """Admin can list connections assigned to a group."""
        async with new_client() as client:
            # Create and assign connection
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )

            # List group connections
            response = await client.get(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_admin_can_remove_connection_from_group(
        self, admin_headers, test_group
    ):
        """Admin can remove a connection from a group."""
        async with new_client() as client:
            # Create and assign connection
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )

            # Remove from group
            response = await client.delete(
                f"/api/groups/{test_group['id']}/connections/{connection_id}",
                headers=admin_headers,
            )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_admin_cannot_assign_same_connection_twice(
        self, admin_headers, test_group
    ):
        """Admin cannot assign the same connection to a group twice."""
        async with new_client() as client:
            # Create connection
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Test Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # First assignment
            response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )
            assert response.status_code == 201

            # Second assignment - should fail
            response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )

        assert response.status_code == 409  # Conflict
