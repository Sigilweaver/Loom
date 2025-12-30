"""Tests for connection operations as Auditor role.

Per roles.md:
- Auditor has R (Read) on ALL connections (for audit purposes)
- Auditor cannot create, update, or delete connections
- Auditor cannot manage connection-group assignments
"""

import pytest
from tests.conftest import new_client


class TestAuditorCanReadAllConnections:
    """Auditor can read all connection information for audit purposes."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_connections(
        self, auditor_headers, admin_headers
    ):
        """Auditor can list all connections."""
        async with new_client() as client:
            # Admin creates a connection
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

            # Auditor lists all connections
            response = await client.get("/api/connections", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_connection_details(
        self, auditor_headers, admin_headers
    ):
        """Auditor can get connection details by ID."""
        async with new_client() as client:
            # Admin creates a connection
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

            # Auditor gets connection details
            response = await client.get(
                f"/api/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == connection_id

    @pytest.mark.asyncio
    async def test_auditor_can_list_group_connections(
        self, auditor_headers, admin_headers, test_group
    ):
        """Auditor can see which connections are assigned to a group."""
        async with new_client() as client:
            # Admin creates and assigns connection
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

            # Auditor lists group connections
            response = await client.get(
                f"/api/groups/{test_group['id']}/connections",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1


class TestAuditorCannotModifyConnections:
    """Auditor cannot create, update, or delete connections."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_create_connection(self, auditor_headers):
        """Auditor cannot create connections."""
        async with new_client() as client:
            response = await client.post(
                "/api/connections",
                headers=auditor_headers,
                json={
                    "name": "Auditor Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "testdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_update_connection(
        self, auditor_headers, admin_headers
    ):
        """Auditor cannot update connections."""
        async with new_client() as client:
            # Admin creates a connection
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

            # Auditor tries to update - should fail
            response = await client.put(
                f"/api/connections/{connection_id}",
                headers=auditor_headers,
                json={"name": "Auditor Updated"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_delete_connection(
        self, auditor_headers, admin_headers
    ):
        """Auditor cannot delete connections."""
        async with new_client() as client:
            # Admin creates a connection
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

            # Auditor tries to delete - should fail
            response = await client.delete(
                f"/api/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403


class TestAuditorCannotManageConnectionGroups:
    """Auditor cannot assign or remove connections from groups."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_assign_connection_to_group(
        self, auditor_headers, admin_headers, test_group
    ):
        """Auditor cannot assign connections to groups."""
        async with new_client() as client:
            # Admin creates a connection
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

            # Auditor tries to assign - should fail
            response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=auditor_headers,
                json={"connection_id": connection_id},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_remove_connection_from_group(
        self, auditor_headers, admin_headers, test_group
    ):
        """Auditor cannot remove connections from groups."""
        async with new_client() as client:
            # Admin creates and assigns connection
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

            # Auditor tries to remove - should fail
            response = await client.delete(
                f"/api/groups/{test_group['id']}/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403
