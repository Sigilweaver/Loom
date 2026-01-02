"""Tests for group operations as User role.

Per roles.md:
- User cannot list all groups
- User cannot access group details (requires auditor)
- User cannot create, update, or delete groups
- User cannot manage group membership
"""

import pytest
from tests.conftest import new_client


class TestUserGroupsFiltering:
    """User sees only groups they belong to."""

    @pytest.mark.asyncio
    async def test_user_sees_empty_list_without_membership(self, user_headers, test_group):
        """User not in any group sees empty list."""
        async with new_client() as client:
            response = await client.get("/api/v1/groups", headers=user_headers)

        assert response.status_code == 200
        # User is not a member of test_group, so sees empty list
        assert response.json()["groups"] == []
        assert response.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_user_cannot_get_group_details(
        self, user_headers, user_in_group
    ):
        """User cannot access GET /groups/{id} - requires auditor role."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        # Even for groups they belong to, GET /groups/{id} requires auditor
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_access_group_not_member_of(
        self, second_user_headers, test_group
    ):
        """User cannot get details of a group they don't belong to."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{test_group['id']}",
                headers=second_user_headers,
            )

        # Should get 403
        assert response.status_code == 403


class TestUserCannotManageGroups:
    """User cannot create, update, or delete groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_create_group(self, user_headers):
        """User cannot create groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/groups",
                headers=user_headers,
                json={"name": "User Created Group"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_update_group(
        self, user_headers, user_in_group
    ):
        """User cannot update groups even if they belong to them."""
        async with new_client() as client:
            response = await client.patch(
                f"/api/v1/groups/{user_in_group['group_id']}",
                headers=user_headers,
                json={"name": "User Updated"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_group(
        self, user_headers, user_in_group
    ):
        """User cannot delete groups even if they belong to them."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageGroupMembership:
    """User cannot add or remove members from groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_add_member_to_group(
        self, user_headers, user_in_group, second_user_info
    ):
        """User cannot add members to groups."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/users/{second_user_info['id']}/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_remove_member_from_group(
        self, user_headers, user_in_group
    ):
        """User cannot remove members from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/users/{user_in_group['user_id']}/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        assert response.status_code == 403
