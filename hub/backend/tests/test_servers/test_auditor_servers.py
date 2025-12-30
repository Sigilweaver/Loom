"""Tests for server operations as Auditor role.

Per roles.md:
- Auditor has Read on ALL servers (for audit purposes)
- Auditor cannot create, update, or delete servers
- Auditor cannot manage server-group assignments
"""

import pytest
from tests.conftest import new_client


class TestAuditorCanReadAllServers:
    """Auditor can read all server information for audit purposes."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_servers(
        self, auditor_headers, test_server
    ):
        """Auditor can list all servers."""
        async with new_client() as client:
            response = await client.get("/api/servers", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_server_details(
        self, auditor_headers, test_server
    ):
        """Auditor can get server details."""
        async with new_client() as client:
            response = await client.get(
                f"/api/servers/{test_server['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == test_server["id"]

    @pytest.mark.asyncio
    async def test_auditor_can_list_server_groups(
        self, auditor_headers, server_in_group
    ):
        """Auditor can see which groups a server belongs to."""
        async with new_client() as client:
            response = await client.get(
                f"/api/servers/{server_in_group['server_id']}/groups",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1


class TestAuditorCannotModifyServers:
    """Auditor cannot update or delete servers.

    Note: Server creation uses registration secret, not user auth,
    so there's no "auditor cannot create" test - servers self-register.
    """

    @pytest.mark.asyncio
    async def test_auditor_cannot_update_server(
        self, auditor_headers, test_server
    ):
        """Auditor cannot update servers."""
        async with new_client() as client:
            response = await client.put(
                f"/api/servers/{test_server['id']}",
                headers=auditor_headers,
                json={"name": "Auditor Updated"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_delete_server(
        self, auditor_headers, test_server
    ):
        """Auditor cannot delete servers."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/servers/{test_server['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403


class TestAuditorCannotManageServerGroups:
    """Auditor cannot assign or remove servers from groups."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_assign_server_to_group(
        self, auditor_headers, test_server, test_group
    ):
        """Auditor cannot assign servers to groups."""
        async with new_client() as client:
            response = await client.post(
                f"/api/servers/{test_server['id']}/groups/{test_group['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_remove_server_from_group(
        self, auditor_headers, server_in_group
    ):
        """Auditor cannot remove servers from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/servers/{server_in_group['server_id']}/groups/{server_in_group['group_id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403
