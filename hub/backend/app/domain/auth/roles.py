"""Role definitions and permissions for Hub authentication

Role hierarchy (highest to lowest):
- owner: First user to register, has total control
- admin: Assigned by owner, can manage non-admin users
- auditor: Read-only access, assigned by owner or admin
- user: Standard user with limited permissions
"""

from enum import Enum


class Role(str, Enum):
    """User roles with hierarchical permissions"""

    OWNER = "owner"
    ADMIN = "admin"
    AUDITOR = "auditor"
    USER = "user"


# Role hierarchy - higher index = lower privilege
ROLE_HIERARCHY = [Role.OWNER, Role.ADMIN, Role.AUDITOR, Role.USER]


def get_role_level(role: str) -> int:
    """Get the privilege level of a role (lower = more privileged).

    Args:
        role: The role string.

    Returns:
        The privilege level (0 = owner, 3 = user).
        Returns 999 for unknown roles (least privileged).
    """
    try:
        return ROLE_HIERARCHY.index(Role(role))
    except ValueError:
        return 999


def can_manage_role(actor_role: str, target_role: str) -> bool:
    """Check if an actor can manage users with a target role.

    Rules:
    - Owner can manage anyone
    - Admin can manage auditors and users only
    - Auditor and User cannot manage anyone

    Args:
        actor_role: The role of the user performing the action.
        target_role: The role of the user being managed.

    Returns:
        True if the actor can manage the target.
    """
    actor_level = get_role_level(actor_role)
    target_level = get_role_level(target_role)

    # Only owner and admin can manage others
    if actor_level > get_role_level(Role.ADMIN):
        return False

    # Can only manage roles below your own
    return actor_level < target_level


def can_assign_role(actor_role: str, new_role: str) -> bool:
    """Check if an actor can assign a specific role to a user.

    Rules:
    - Owner can assign any role except owner (there's only one owner)
    - Admin can assign auditor or user roles only
    - Others cannot assign roles

    Args:
        actor_role: The role of the user performing the action.
        new_role: The role being assigned.

    Returns:
        True if the actor can assign this role.
    """
    # No one can create another owner
    if new_role == Role.OWNER:
        return False

    actor_level = get_role_level(actor_role)

    # Only owner and admin can assign roles
    if actor_level > get_role_level(Role.ADMIN):
        return False

    # Can only assign roles below your own
    new_level = get_role_level(new_role)
    return actor_level < new_level
