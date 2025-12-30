"""Tests for server operations as a User role.

Per roles.md:
- Users have R (read) on Servers via group membership
- Users can only see servers assigned to groups they belong to
"""

import pytest
from tests.conftest import new_client


class TestUserCanSeeOwnServers:
    """User can see servers assigned to their groups via /servers/my."""

    @pytest.mark.asyncio
    async def test_user_can_list_own_servers(
        self, user_headers, user_in_group, server_in_group
    ):
        """User can list servers assigned to their groups."""
        async with new_client() as client:
            response = await client.get("/api/servers/my", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["servers"][0]["name"] == "Test Server"

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_group(
        self, user_headers, test_server
    ):
        """User without group membership sees no servers."""
        async with new_client() as client:
            # Server exists but user is not in any group
            response = await client.get("/api/servers/my", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_when_server_not_in_group(
        self, user_headers, user_in_group, test_server
    ):
        """User in group sees no servers if server not assigned to group."""
        async with new_client() as client:
            # User is in group, server exists but is not assigned to any group
            response = await client.get("/api/servers/my", headers=user_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0


class TestUserCannotAccessAllServers:
    """User cannot use the all-servers endpoints (auditor+ only)."""

    @pytest.mark.asyncio
    async def test_user_cannot_list_all_servers(self, user_headers):
        """User cannot use GET /servers (requires auditor+)."""
        async with new_client() as client:
            response = await client.get("/api/servers", headers=user_headers)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_get_server_details(
        self, user_headers, test_server
    ):
        """User cannot get server details via GET /servers/{id}."""
        async with new_client() as client:
            response = await client.get(
                f"/api/servers/{test_server['id']}",
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
                f"/api/servers/{test_server['id']}",
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
                f"/api/servers/{test_server['id']}",
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
                f"/api/servers/{test_server['id']}/groups/{test_group['id']}",
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
                f"/api/servers/{server_in_group['server_id']}/groups/{server_in_group['group_id']}",
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
                f"/api/servers/{test_server['id']}/groups",
                headers=user_headers,
            )

        assert response.status_code == 403
