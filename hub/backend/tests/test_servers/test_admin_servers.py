"""Tests for server operations as Admin role.

Per roles.md:
- Admin/Owner have CRUD on Servers
- Admin manages infrastructure including server-group assignments
"""

import pytest
from tests.conftest import new_client


class TestAdminCanManageServers:
    """Admin can perform full CRUD on servers."""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_servers(self, admin_headers, test_server):
        """Admin can list all servers."""
        async with new_client() as client:
            response = await client.get("/api/v1/servers", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_get_server_details(
        self, admin_headers, test_server
    ):
        """Admin can get server details."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/servers/{test_server['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == test_server["id"]

    @pytest.mark.asyncio
    async def test_admin_can_update_server(self, admin_headers, test_server):
        """Admin can update server configuration."""
        async with new_client() as client:
            response = await client.put(
                f"/api/v1/servers/{test_server['id']}",
                headers=admin_headers,
                json={"name": "Updated Server Name"},
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Server Name"

    @pytest.mark.asyncio
    async def test_admin_can_delete_server(self, admin_headers, test_server):
        """Admin can delete servers."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/servers/{test_server['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCanManageServerGroups:
    """Admin can assign and remove servers from groups."""

    @pytest.mark.asyncio
    async def test_admin_can_assign_server_to_group(
        self, admin_headers, test_server, test_group
    ):
        """Admin can assign a server to a group."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/servers/{test_server['id']}/groups/{test_group['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["total"] == 1
        assert data["groups"][0]["group_name"] == "Test Group"

    @pytest.mark.asyncio
    async def test_admin_can_list_server_groups(
        self, admin_headers, server_in_group
    ):
        """Admin can list groups assigned to a server."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/servers/{server_in_group['server_id']}/groups",
                headers=admin_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_admin_can_remove_server_from_group(
        self, admin_headers, server_in_group
    ):
        """Admin can remove a server from a group."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/servers/{server_in_group['server_id']}/groups/{server_in_group['group_id']}",
                headers=admin_headers,
            )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_admin_cannot_assign_server_to_nonexistent_group(
        self, admin_headers, test_server
    ):
        """Admin gets 404 when assigning to nonexistent group."""
        import uuid

        async with new_client() as client:
            response = await client.post(
                f"/api/v1/servers/{test_server['id']}/groups/{uuid.uuid4()}",
                headers=admin_headers,
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_admin_cannot_double_assign_server_to_group(
        self, admin_headers, server_in_group
    ):
        """Admin gets 409 when server already assigned to group."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/servers/{server_in_group['server_id']}/groups/{server_in_group['group_id']}",
                headers=admin_headers,
            )

        assert response.status_code == 409


class TestOwnerHasSamePermissionsAsAdmin:
    """Owner has same server permissions as Admin."""

    @pytest.mark.asyncio
    async def test_owner_can_manage_servers(self, owner_headers, test_server):
        """Owner can list, update, and delete servers."""
        async with new_client() as client:
            # List
            response = await client.get("/api/v1/servers", headers=owner_headers)
            assert response.status_code == 200

            # Update
            response = await client.put(
                f"/api/v1/servers/{test_server['id']}",
                headers=owner_headers,
                json={"name": "Owner Updated"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_manage_server_groups(
        self, owner_headers, test_server, test_group
    ):
        """Owner can assign/remove servers from groups."""
        async with new_client() as client:
            # Assign
            response = await client.post(
                f"/api/v1/servers/{test_server['id']}/groups/{test_group['id']}",
                headers=owner_headers,
            )
            assert response.status_code == 201

            # Remove
            response = await client.delete(
                f"/api/v1/servers/{test_server['id']}/groups/{test_group['id']}",
                headers=owner_headers,
            )
            assert response.status_code == 204
