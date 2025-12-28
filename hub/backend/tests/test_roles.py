"""Tests for role definitions and permissions"""

import pytest

from app.domain.auth.roles import (
    Role,
    can_assign_role,
    can_manage_role,
    get_role_level,
)


class TestGetRoleLevel:
    """Tests for get_role_level function"""

    def test_owner_is_most_privileged(self):
        """Owner has lowest level (most privileged)"""
        assert get_role_level(Role.OWNER.value) == 0

    def test_admin_is_second(self):
        """Admin is second most privileged"""
        assert get_role_level(Role.ADMIN.value) == 1

    def test_auditor_is_third(self):
        """Auditor is third"""
        assert get_role_level(Role.AUDITOR.value) == 2

    def test_user_is_least_privileged(self):
        """User has highest level (least privileged)"""
        assert get_role_level(Role.USER.value) == 3

    def test_unknown_role_returns_high_level(self):
        """Unknown roles get very high level"""
        assert get_role_level("unknown") == 999


class TestCanManageRole:
    """Tests for can_manage_role function"""

    def test_owner_can_manage_all(self):
        """Owner can manage all other roles"""
        assert can_manage_role(Role.OWNER.value, Role.ADMIN.value) is True
        assert can_manage_role(Role.OWNER.value, Role.AUDITOR.value) is True
        assert can_manage_role(Role.OWNER.value, Role.USER.value) is True

    def test_owner_cannot_manage_owner(self):
        """Owner cannot manage other owners (same level)"""
        assert can_manage_role(Role.OWNER.value, Role.OWNER.value) is False

    def test_admin_can_manage_lower_roles(self):
        """Admin can manage auditors and users"""
        assert can_manage_role(Role.ADMIN.value, Role.AUDITOR.value) is True
        assert can_manage_role(Role.ADMIN.value, Role.USER.value) is True

    def test_admin_cannot_manage_admin_or_owner(self):
        """Admin cannot manage admins or owner"""
        assert can_manage_role(Role.ADMIN.value, Role.ADMIN.value) is False
        assert can_manage_role(Role.ADMIN.value, Role.OWNER.value) is False

    def test_auditor_cannot_manage_anyone(self):
        """Auditor cannot manage anyone"""
        assert can_manage_role(Role.AUDITOR.value, Role.USER.value) is False
        assert can_manage_role(Role.AUDITOR.value, Role.AUDITOR.value) is False

    def test_user_cannot_manage_anyone(self):
        """User cannot manage anyone"""
        assert can_manage_role(Role.USER.value, Role.USER.value) is False


class TestCanAssignRole:
    """Tests for can_assign_role function"""

    def test_owner_can_assign_admin(self):
        """Owner can assign admin role"""
        assert can_assign_role(Role.OWNER.value, Role.ADMIN.value) is True

    def test_owner_can_assign_auditor(self):
        """Owner can assign auditor role"""
        assert can_assign_role(Role.OWNER.value, Role.AUDITOR.value) is True

    def test_owner_can_assign_user(self):
        """Owner can assign user role"""
        assert can_assign_role(Role.OWNER.value, Role.USER.value) is True

    def test_owner_cannot_assign_owner(self):
        """Owner cannot assign owner role (there's only one)"""
        assert can_assign_role(Role.OWNER.value, Role.OWNER.value) is False

    def test_admin_can_assign_auditor(self):
        """Admin can assign auditor role"""
        assert can_assign_role(Role.ADMIN.value, Role.AUDITOR.value) is True

    def test_admin_can_assign_user(self):
        """Admin can assign user role"""
        assert can_assign_role(Role.ADMIN.value, Role.USER.value) is True

    def test_admin_cannot_assign_admin(self):
        """Admin cannot assign admin role (same level)"""
        assert can_assign_role(Role.ADMIN.value, Role.ADMIN.value) is False

    def test_admin_cannot_assign_owner(self):
        """Admin cannot assign owner role"""
        assert can_assign_role(Role.ADMIN.value, Role.OWNER.value) is False

    def test_auditor_cannot_assign_any_role(self):
        """Auditor cannot assign any role"""
        assert can_assign_role(Role.AUDITOR.value, Role.USER.value) is False

    def test_user_cannot_assign_any_role(self):
        """User cannot assign any role"""
        assert can_assign_role(Role.USER.value, Role.USER.value) is False
