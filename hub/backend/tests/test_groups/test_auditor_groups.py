"""Tests for group operations as Auditor role.

Per roles.md:
- Auditor has Read on ALL groups (for audit purposes)
- Auditor cannot create, update, or delete groups
- Auditor cannot manage group membership
"""

import pytest

from tests.conftest import new_client


class TestAuditorCanReadAllGroups:
    """Auditor can read all group information for audit purposes."""

    @pytest.mark.asyncio
    async def test_auditor_can_list_all_groups(
        self, auditor_headers, test_group
    ):
        """Auditor can list all groups."""
        async with new_client() as client:
            response = await client.get("/api/v1/groups", headers=auditor_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_auditor_can_get_group_details(
        self, auditor_headers, test_group
    ):
        """Auditor can get group details."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{test_group['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == test_group["id"]

    @pytest.mark.asyncio
    async def test_auditor_can_list_group_members(
        self, auditor_headers, user_in_group
    ):
        """Auditor can see group membership for audit."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{user_in_group['group_id']}/members",
                headers=auditor_headers,
            )

        assert response.status_code == 200


class TestAuditorCannotModifyGroups:
    """Auditor cannot create, update, or delete groups."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_create_group(self, auditor_headers):
        """Auditor cannot create groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/groups",
                headers=auditor_headers,
                json={"name": "Auditor Group"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_update_group(
        self, auditor_headers, test_group
    ):
        """Auditor cannot update groups."""
        async with new_client() as client:
            response = await client.patch(
                f"/api/v1/groups/{test_group['id']}",
                headers=auditor_headers,
                json={"name": "Auditor Updated"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_delete_group(
        self, auditor_headers, test_group
    ):
        """Auditor cannot delete groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/groups/{test_group['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403


class TestAuditorCannotManageGroupMembership:
    """Auditor cannot add or remove members from groups."""

    @pytest.mark.asyncio
    async def test_auditor_cannot_add_member_to_group(
        self, auditor_headers, test_group, second_user_info
    ):
        """Auditor cannot add members to groups."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/users/{second_user_info['id']}/groups/{test_group['id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_auditor_cannot_remove_member_from_group(
        self, auditor_headers, user_in_group
    ):
        """Auditor cannot remove members from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/users/{user_in_group['user_id']}/groups/{user_in_group['group_id']}",
                headers=auditor_headers,
            )

        assert response.status_code == 403
