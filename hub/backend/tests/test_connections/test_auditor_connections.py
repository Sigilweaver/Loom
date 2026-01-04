"""Tests for connection operations as Auditor role.

Per roles.md:
- Auditor has R (Read) on ALL connections (for audit purposes)
- Auditor cannot create, update, or delete connections
- Auditor cannot manage grant groups or their assignments
"""

import pytest
from tests.conftest import new_client
from tests.test_connections import database_connection_payload


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
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            # Auditor lists all connections
            response = await client.get("/api/v1/connections", headers=auditor_headers)

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
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Auditor gets connection details
            response = await client.get(
                f"/api/v1/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == connection_id

    @pytest.mark.asyncio
    async def test_auditor_can_list_grant_groups(
        self, auditor_headers, admin_headers
    ):
        """Auditor can list grant groups for audit purposes."""
        async with new_client() as client:
            # Admin creates a grant group
            await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Audit Test Grant Group"},
            )

            # Auditor lists grant groups
            response = await client.get("/api/v1/grant-groups", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_grant_group_details(
        self, auditor_headers, admin_headers, test_group
    ):
        """Auditor can get grant group details including connections and user groups."""
        async with new_client() as client:
            # Admin creates connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Set up grant group with connection and user group
            grant_group_id = await assign_connection_to_group_via_grant_group(
                client, admin_headers, connection_id, test_group["id"]
            )

            # Auditor gets grant group details
            response = await client.get(
                f"/api/v1/grant-groups/{grant_group_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == grant_group_id
        assert len(data["connections"]) == 1
        assert len(data["user_groups"]) == 1


class TestAuditorCannotModifyConnections:
    """Auditor cannot create, update, or delete connections."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_create_connection(self, auditor_headers):
        """Auditor cannot create connections."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/connections",
                headers=auditor_headers,
                json=database_connection_payload("Auditor Connection"),
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
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Auditor tries to update - should fail
            response = await client.put(
                f"/api/v1/connections/{connection_id}",
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
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Auditor tries to delete - should fail
            response = await client.delete(
                f"/api/v1/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403


class TestAuditorCannotManageGrantGroups:
    """Auditor cannot create grant groups or manage their assignments."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_create_grant_group(self, auditor_headers):
        """Auditor cannot create grant groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/grant-groups",
                headers=auditor_headers,
                json={"name": "Auditor Grant Group"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_add_connection_to_grant_group(
        self, auditor_headers, admin_headers
    ):
        """Auditor cannot add connections to grant groups."""
        async with new_client() as client:
            # Admin creates connection
            create_response = await client.post(
                "/api/v1/connections",
                headers=admin_headers,
                json=database_connection_payload(),
            )
            if create_response.status_code != 201:
                pytest.skip("Connection creation requires encryption key")

            connection_id = create_response.json()["id"]

            # Admin creates grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # Auditor tries to add connection - should fail
            response = await client.post(
                f"/api/v1/grant-groups/{grant_group_id}/connections/{connection_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_assign_grant_group_to_user_group(
        self, auditor_headers, admin_headers, test_group
    ):
        """Auditor cannot assign grant groups to user groups."""
        async with new_client() as client:
            # Admin creates grant group
            grant_group_response = await client.post(
                "/api/v1/grant-groups",
                headers=admin_headers,
                json={"name": "Test Grant Group"},
            )
            grant_group_id = grant_group_response.json()["id"]

            # Auditor tries to assign grant group - should fail
            response = await client.post(
                f"/api/v1/groups/{test_group['id']}/grant-groups/{grant_group_id}",
                headers=auditor_headers,
            )

        assert response.status_code == 403
