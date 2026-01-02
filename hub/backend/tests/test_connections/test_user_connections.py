"""Tests for connection operations as a User role.

Per roles.md:
- Users have R (Read) on connections via group membership
- Users can only see connections assigned to groups they belong to (via grant groups)
- Users cannot create, update, or delete connections
"""

import pytest
from tests.conftest import new_client


async def assign_connection_to_group_via_grant_group(
    client, admin_headers, connection_id: str, group_id: str
) -> str:
    """
    Helper: Assign a connection to a user group via a grant group.
    
    Creates a grant group, adds the connection to it, and assigns the
    grant group to the user group. Returns the grant group ID.
    """
    # Create grant group
    grant_group_response = await client.post(
        "/api/v1/grant-groups",
        headers=admin_headers,
        json={"name": f"Grant Group for {connection_id[:8]}"},
    )
    assert grant_group_response.status_code == 201
    grant_group_id = grant_group_response.json()["id"]
    
    # Add connection to grant group
    add_conn_response = await client.post(
        f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
        headers=admin_headers,
    )
    assert add_conn_response.status_code == 201
    
    # Assign grant group to user group
    assign_response = await client.post(
        f"/api/v1/groups/{group_id}/grant-groups/{grant_group_id}",
        headers=admin_headers,
    )
    assert assign_response.status_code == 201
    
    return grant_group_id


class TestUserCanSeeOwnConnections:
    """User can see connections assigned to their groups via grant groups."""

    @pytest.mark.asyncio
    async def test_user_can_list_connections_in_own_groups(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User can list connections assigned to their groups via grant groups."""
        async with new_client() as client:
            # Admin creates a connection
            create_response = await client.post(
                "/api/v1/connections",
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

            # Admin assigns connection to user's group via grant group
            await assign_connection_to_group_via_grant_group(
                client, admin_headers, connection_id, test_group["id"]
            )

            # User lists connections - should see the connection
            response = await client.get("/api/v1/connections", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["connections"][0]["name"] == "Test Connection"

    @pytest.mark.asyncio
    async def test_user_can_get_connection_in_own_groups(
        self, user_headers, user_in_group, admin_headers, test_group
    ):
        """User can get details of a connection accessible via their group."""
        async with new_client() as client:
            # Admin creates and assigns connection
            create_response = await client.post(
                "/api/v1/connections",
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

            await assign_connection_to_group_via_grant_group(
                client, admin_headers, connection_id, test_group["id"]
            )

            # User gets connection details
            response = await client.get(
                f"/api/v1/connections/{connection_id}",
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
                "/api/v1/connections",
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
            response = await client.get("/api/v1/connections", headers=user_headers)

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
                "/api/v1/connections",
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
                f"/api/v1/connections/{connection_id}",
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
                "/api/v1/connections",
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
                "/api/v1/connections",
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

            await assign_connection_to_group_via_grant_group(
                client, admin_headers, connection_id, test_group["id"]
            )

            # User tries to update - should fail
            response = await client.put(
                f"/api/v1/connections/{connection_id}",
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
                "/api/v1/connections",
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

            await assign_connection_to_group_via_grant_group(
                client, admin_headers, connection_id, test_group["id"]
            )

            # User tries to delete - should fail
            response = await client.delete(
                f"/api/v1/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageGrantGroups:
    """User cannot manage grant groups or their assignments."""

    @pytest.mark.asyncio
    async def test_user_cannot_create_grant_group(self, user_headers):
        """User cannot create grant groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/grant-groups",
                headers=user_headers,
                json={"name": "User Grant Group"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_add_connection_to_grant_group(
        self, user_headers, admin_headers
    ):
        """User cannot add connections to grant groups."""
        async with new_client() as client:
            # Admin creates connection and grant group
            create_response = await client.post(
                "/api/v1/connections",
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

            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # User tries to add connection - should fail
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_assign_grant_group_to_user_group(
        self, user_headers, admin_headers, test_group
    ):
        """User cannot assign grant groups to user groups."""
        async with new_client() as client:
            # Admin creates grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # User tries to assign grant group - should fail
            response = await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=user_headers,
            )

        assert response.status_code == 403
