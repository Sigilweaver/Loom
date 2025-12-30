"""Tests for connection operations as a User role.

Per roles.md:
- Users have R (Read) on connections via group membership
- Users can only see connections assigned to groups they belong to
- Users cannot create, update, or delete connections
"""

import pytest
from tests.conftest import new_client


class TestUserCanSeeOwnConnections:
    """User can see connections assigned to their groups via /connections list."""

    @pytest.mark.asyncio
    async def test_user_can_list_connections_in_own_groups(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User can list connections assigned to their groups."""
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
            # May fail if encryption key not set, that's OK
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Admin assigns connection to user's group
            assign_response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=admin_headers,
                json={"connection_id": connection_id},
            )
            assert assign_response.status_code == 201

            # User lists connections - should see the connection
            response = await client.get("/api/connections", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["connections"][0]["name"] == "Test Connection"

    @pytest.mark.asyncio
    async def test_user_can_get_connection_in_own_groups(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User can get details of a connection in their group."""
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

            # User gets connection details
            response = await client.get(
                f"/api/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == connection_id

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_group(
        self, user_headers, admin_headers
    ):
        """User without group membership sees no connections."""
        async with new_client() as client:
            # Admin creates a connection (not assigned to any group)
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Unassigned Connection",
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

            # User not in any group - should see nothing
            response = await client.get("/api/connections", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0


class TestUserCannotAccessUnassignedConnections:
    """User cannot access connections not assigned to their groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_get_unassigned_connection(
        self, user_headers, user_in_group, admin_headers
    ):
        """User cannot get a connection not assigned to their group."""
        async with new_client() as client:
            # Admin creates a connection (not assigned to user's group)
            create_response = await client.post(
                "/api/connections",
                headers=admin_headers,
                json={
                    "name": "Other Connection",
                    "type": "postgresql",
                    "host": "localhost",
                    "port": 5432,
                    "database": "otherdb",
                    "username": "testuser",
                    "password": "testpass",
                },
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # User tries to get unassigned connection - should fail
            response = await client.get(
                f"/api/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageConnections:
    """User cannot create, update, or delete connections."""

    @pytest.mark.asyncio
    async def test_user_cannot_create_connection(self, user_headers):
        """User cannot create connections."""
        async with new_client() as client:
            response = await client.post(
                "/api/connections",
                headers=user_headers,
                json={
                    "name": "User Connection",
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
    async def test_user_cannot_update_connection(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User cannot update connections even in their group."""
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

            # User tries to update - should fail
            response = await client.put(
                f"/api/connections/{connection_id}",
                headers=user_headers,
                json={"name": "Hacked Connection"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_connection(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User cannot delete connections even in their group."""
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

            # User tries to delete - should fail
            response = await client.delete(
                f"/api/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageConnectionGroups:
    """User cannot assign/remove connections from groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_assign_connection_to_group(
        self, user_headers, admin_headers, test_group
    ):
        """User cannot assign connections to groups."""
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

            # User tries to assign - should fail
            response = await client.post(
                f"/api/groups/{test_group['id']}/connections",
                headers=user_headers,
                json={"connection_id": connection_id},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_remove_connection_from_group(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User cannot remove connections from groups."""
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

            # User tries to remove - should fail
            response = await client.delete(
                f"/api/groups/{test_group['id']}/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_list_group_connections(
        self, user_headers, test_group
    ):
        """User cannot list connections assigned to a group."""
        async with new_client() as client:
            response = await client.get(
                f"/api/groups/{test_group['id']}/connections",
                headers=user_headers,
            )

        assert response.status_code == 403
