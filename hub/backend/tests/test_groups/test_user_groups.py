"""Tests for group operations as User role.

Per roles.md:
- User has Read on groups they belong to (own)
- User cannot create, update, or delete groups
- User cannot manage group membership
"""

import pytest
from tests.conftest import new_client


class TestUserCanReadOwnGroups:
    """User can only read their own groups via /groups/my endpoint."""

    @pytest.mark.asyncio
    async def test_user_can_list_own_groups(
        self, user_headers, user_in_group
    ):
        """User can list groups they belong to via /groups/my."""
        async with new_client() as client:
            response = await client.get(
                "/api/groups/my",
                headers=user_headers,
            )

        assert response.status_code == 200
        data = response.json()
        group_ids = {g["id"] for g in data.get("groups", [])}
        assert user_in_group["group_id"] in group_ids

    @pytest.mark.asyncio
    async def test_user_cannot_get_group_details_directly(
        self, user_headers, user_in_group
    ):
        """User cannot access GET /groups/{id} - requires auditor role."""
        async with new_client() as client:
            response = await client.get(
                f"/api/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        # Even for groups they belong to, GET /groups/{id} requires auditor
        assert response.status_code == 403


class TestUserCannotAccessOtherGroups:
    """User cannot read groups they don't belong to."""

    @pytest.mark.asyncio
    async def test_user_cannot_list_all_groups(self, user_headers, test_group):
        """User cannot list all groups."""
        async with new_client() as client:
            response = await client.get("/api/groups", headers=user_headers)

        # User may get 403 or empty list depending on implementation
        # If 200, they should only see their own groups
        if response.status_code == 200:
            data = response.json()
            # All returned groups should be ones user belongs to
            # (test_group is not one they belong to)
            group_ids = {g["id"] for g in data.get("groups", [])}
            assert test_group["id"] not in group_ids
        else:
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_access_group_not_member_of(
        self, second_user_headers, test_group
    ):
        """User cannot get details of a group they don't belong to."""
        async with new_client() as client:
            response = await client.get(
                f"/api/groups/{test_group['id']}",
                headers=second_user_headers,
            )

        # Should get 403 or 404
        assert response.status_code in (403, 404)


class TestUserCannotManageGroups:
    """User cannot create, update, or delete groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_create_group(self, user_headers):
        """User cannot create groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/groups",
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
                f"/api/groups/{user_in_group['group_id']}",
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
                f"/api/groups/{user_in_group['group_id']}",
                headers=user_headers,
            )

        assert response.status_code == 403


class TestUserCannotManageGroupMembership:
    """User cannot add or remove members from groups."""

    @pytest.mark.asyncio
    async def test_user_cannot_add_member_to_group(
        self, user_headers, user_in_group, second_user_headers
    ):
        """User cannot add members to groups."""
        # Get second user id somehow - this test may need adjustment
        async with new_client() as client:
            response = await client.post(
                f"/api/groups/{user_in_group['group_id']}/members",
                headers=user_headers,
                json={"user_id": "some-user-id"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_remove_member_from_group(
        self, user_headers, user_in_group
    ):
        """User cannot remove members from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/groups/{user_in_group['group_id']}/members/some-user-id",
                headers=user_headers,
            )

        assert response.status_code == 403
