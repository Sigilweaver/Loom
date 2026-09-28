"""Tests for server operations as a User role.

Per roles.md:
- Users see servers via group membership (auto-filtered)
- Users cannot access server details directly
"""

import pytest

from tests.conftest import new_client


class TestUserServersFiltering:
    """User sees only servers available via group membership."""

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_group(self, user_headers):
        """User without group membership sees empty server list."""
        async with new_client() as client:
            response = await client.get("/api/v1/servers", headers=user_headers)

        assert response.status_code == 200
        assert response.json()["servers"] == []
        assert response.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_user_sees_servers_in_group(
        self, user_headers, user_in_group, server_in_group
    ):
        """User in group sees servers assigned to that group."""
        async with new_client() as client:
            response = await client.get("/api/v1/servers", headers=user_headers)

        assert response.status_code == 200
        servers = response.json()["servers"]
        server_ids = [s["id"] for s in servers]
        assert server_in_group["server_id"] in server_ids

    @pytest.mark.asyncio
    async def test_user_cannot_get_server_details(
        self, user_headers, test_server
    ):
        """User cannot get server details via GET /servers/{id}."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/servers/{test_server['id']}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageServers:
    """User cannot create, update, or delete servers."""

    @pytest.mark.asyncio
    async def test_user_cannot_update_server(
        self, user_headers, test_server
    ):
        """User cannot update server configuration."""
        async with new_client() as client:
            response = await client.put(
                f"/api/v1/servers/{test_server['id']}",
                headers=user_headers,
                json={"name": "Hacked Server"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_server(
        self, user_headers, test_server
    ):
        """User cannot delete servers."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/servers/{test_server['id']}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageServerGroups:
    """User cannot assign/remove servers from groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_assign_server_to_group(
        self, user_headers, test_server, test_group
    ):
        """User cannot assign servers to groups."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/servers/{test_server['id']}/groups/{test_group['id']}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_remove_server_from_group(
        self, user_headers, server_in_group
    ):
        """User cannot remove servers from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/servers/{server_in_group['server_id']}/groups/{server_in_group['group_id']}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_list_server_groups(
        self, user_headers, test_server
    ):
        """User cannot see which groups a server is assigned to."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/servers/{test_server['id']}/groups",
                headers=user_headers,
            )

        assert response.status_code == 403
