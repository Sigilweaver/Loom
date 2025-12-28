"""FastAPI dependencies for authentication and authorization"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.domain.auth.roles import Role, get_role_level
from app.domain.auth.sessions import SessionInfo, SessionManager


def _extract_token(request: Request) -> str | None:
    """Extract bearer token from Authorization header.

    Args:
        request: The incoming request.

    Returns:
        The token string if present and valid format, None otherwise.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SessionInfo:
    """Dependency to get the current authenticated user.

    Extracts the bearer token from the Authorization header,
    validates the session, and returns the session info.

    Raises:
        HTTPException: 401 if not authenticated or session invalid.

    Returns:
        SessionInfo with user details.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_manager = SessionManager(db)
    session_info = await session_manager.validate_session(token)

    if session_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return session_info


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SessionInfo | None:
    """Dependency to optionally get the current user.

    Unlike get_current_user, this returns None instead of raising
    an exception if not authenticated. Useful for endpoints that
    behave differently for authenticated vs anonymous users.

    Returns:
        SessionInfo if authenticated, None otherwise.
    """
    token = _extract_token(request)
    if not token:
        return None

    session_manager = SessionManager(db)
    return await session_manager.validate_session(token)


# Type alias for cleaner dependency injection
CurrentUser = Annotated[SessionInfo, Depends(get_current_user)]
OptionalUser = Annotated[SessionInfo | None, Depends(get_optional_user)]


def require_role(*allowed_roles: Role | str):
    """Create a dependency that requires specific roles.

    Args:
        *allowed_roles: Roles that are allowed access.

    Returns:
        A dependency function that validates the user's role.

    Example:
        @router.get("/admin")
        async def admin_only(user: CurrentUser = Depends(require_role(Role.OWNER, Role.ADMIN))):
            pass
    """
    # Normalize to strings
    allowed = {str(r.value if isinstance(r, Role) else r) for r in allowed_roles}

    async def dependency(user: CurrentUser) -> SessionInfo:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed)}",
            )
        return user

    return dependency


def require_min_role(min_role: Role | str):
    """Create a dependency that requires a minimum role level.

    Uses the role hierarchy to check if the user's role is at least
    as privileged as the required role.

    Args:
        min_role: The minimum role level required.

    Returns:
        A dependency function that validates the user's role level.

    Example:
        @router.get("/management")
        async def admin_and_above(user: CurrentUser = Depends(require_min_role(Role.ADMIN))):
            # Allows owner and admin
            pass
    """
    min_role_str = str(min_role.value if isinstance(min_role, Role) else min_role)
    min_level = get_role_level(min_role_str)

    async def dependency(user: CurrentUser) -> SessionInfo:
        user_level = get_role_level(user.role)
        if user_level > min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {min_role_str} or higher",
            )
        return user

    return dependency


# Pre-built role dependencies for common cases
RequireOwner = Depends(require_role(Role.OWNER))
RequireAdmin = Depends(require_min_role(Role.ADMIN))  # Owner or Admin
RequireAuditor = Depends(require_min_role(Role.AUDITOR))  # Owner, Admin, or Auditor
