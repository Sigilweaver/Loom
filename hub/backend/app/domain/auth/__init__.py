"""Authentication domain module - password hashing, sessions, and roles"""

from app.domain.auth.password import hash_password, needs_rehash, verify_password
from app.domain.auth.roles import Role, can_assign_role, can_manage_role, get_role_level
from app.domain.auth.sessions import SessionInfo, SessionManager

__all__ = [
    # Password
    "hash_password",
    "verify_password",
    "needs_rehash",
    # Sessions
    "SessionManager",
    "SessionInfo",
    # Roles
    "Role",
    "get_role_level",
    "can_manage_role",
    "can_assign_role",
]
