"""Tests for group operations as Admin role.

Per roles.md:
- Admin/Owner have CRUD on Groups
- Admin manages group membership
"""

import pytest
from tests.conftest import new_client


class TestAdminCanManageGroups:
    """Admin can perform full CRUD on groups."""

    @pytest.mark.asyncio
    async def test_admin_can_list_all_groups(self, admin_headers, test_group):
        """Admin can list all groups."""
        async with new_client() as client:
            response = await client.get("/api/v1/groups", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_create_group(self, admin_headers):
        """Admin can create groups."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/groups",
                headers=admin_headers,
                json={"name": "Admin Created Group"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Admin Created Group"

    @pytest.mark.asyncio
    async def test_admin_can_get_group_details(
        self, admin_headers, test_group
    ):
        """Admin can get group details."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{test_group['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.json()["id"] == test_group["id"]

    @pytest.mark.asyncio
    async def test_admin_can_update_group(self, admin_headers, test_group):
        """Admin can update group configuration."""
        async with new_client() as client:
            response = await client.patch(
                f"/api/v1/groups/{test_group['id']}",
                headers=admin_headers,
                json={"name": "Admin Updated Group"},
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Admin Updated Group"

    @pytest.mark.asyncio
    async def test_admin_can_delete_group(self, admin_headers, test_group):
        """Admin can delete groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/groups/{test_group['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestAdminCanManageGroupMembership:
    """Admin can add and remove members from groups."""

    @pytest.mark.asyncio
    async def test_admin_can_list_group_members(
        self, admin_headers, user_in_group
    ):
        """Admin can list group members."""
        async with new_client() as client:
            response = await client.get(
                f"/api/v1/groups/{user_in_group['group_id']}/members",
                headers=admin_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_admin_can_add_member_to_group(
        self, admin_headers, test_group, second_user_info
    ):
        """Admin can add members to groups."""
        async with new_client() as client:
            response = await client.post(
                f"/api/v1/users/{second_user_info['id']}/groups/{test_group['id']}",
                headers=admin_headers,
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_admin_can_remove_member_from_group(
        self, admin_headers, user_in_group
    ):
        """Admin can remove members from groups."""
        async with new_client() as client:
            response = await client.delete(
                f"/api/v1/users/{user_in_group['user_id']}/groups/{user_in_group['group_id']}",
                headers=admin_headers,
            )

        assert response.status_code == 204


class TestOwnerHasSamePermissionsAsAdmin:
    """Owner has same group permissions as Admin."""

    @pytest.mark.asyncio
    async def test_owner_can_manage_groups(self, owner_headers):
        """Owner can create, list, update, and delete groups."""
        async with new_client() as client:
            # Create
            response = await client.post(
                "/api/v1/groups",
                headers=owner_headers,
                json={"name": "Owner Created Group"},
            )
            assert response.status_code == 201
            group_id = response.json()["id"]

            # List
            response = await client.get("/api/v1/groups", headers=owner_headers)
            assert response.status_code == 200

            # Update
            response = await client.patch(
                f"/api/v1/groups/{group_id}",
                headers=owner_headers,
                json={"name": "Owner Updated Group"},
            )
            assert response.status_code == 200

            # Delete
            response = await client.delete(
                f"/api/v1/groups/{group_id}",
                headers=owner_headers,
            )
            assert response.status_code == 204
