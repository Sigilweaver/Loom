"""FastAPI dependencies for authentication and authorization"""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.domain.auth.cookies import SAFE_METHODS, SESSION_COOKIE, csrf_is_valid
from app.domain.auth.roles import Role, get_role_level
from app.domain.auth.sessions import SessionInfo, SessionManager


def _bearer_token(request: Request) -> str | None:
    """Extract the bearer token from the Authorization header, if any."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]


def extract_session_token(request: Request) -> tuple[str | None, bool]:
    """Find the session token of a request.

    API clients send ``Authorization: Bearer <token>``; the Hub web app sends
    the session cookie. The header wins when both are present.

    Returns:
        ``(token, from_cookie)``. ``token`` is None when the request carries
        neither.
    """
    token = _bearer_token(request)
    if token:
        return token, False
    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie:
        return cookie, True
    return None, False


def _require_csrf(request: Request, token: str) -> None:
    """Reject a state-changing, cookie-authenticated request without CSRF proof."""
    if request.method in SAFE_METHODS:
        return
    if not csrf_is_valid(request, token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing or invalid CSRF token",
        )


def _extract_token(request: Request) -> str | None:
    """Extract the session token, enforcing CSRF for cookie sessions.

    Raises:
        HTTPException: 403 for a cookie-authenticated, state-changing request
            without a valid ``X-CSRF-Token`` header.
    """
    token, from_cookie = extract_session_token(request)
    if token and from_cookie:
        _require_csrf(request, token)
    return token


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SessionInfo:
    """Dependency to get the current authenticated user.

    Takes the session token from the Authorization header or the web app's
    session cookie, validates the session, and returns the session info.

    Raises:
        HTTPException: 401 if not authenticated or session invalid; 403 for a
            cookie-authenticated, state-changing request without a valid
            CSRF token.

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

    # Expose the identity for per-user rate-limiting (see _user_or_ip). Set on
    # request.state so slowapi's key function can read it after this dependency
    # resolves and before the route's limit is evaluated.
    request.state.user_id = str(session_info.user_id)

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
    session_info = await session_manager.validate_session(token)
    if session_info is not None:
        # Expose identity for per-user rate-limiting (see _user_or_ip).
        request.state.user_id = str(session_info.user_id)
    return session_info


# Type alias for cleaner dependency injection
CurrentUser = Annotated[SessionInfo, Depends(get_current_user)]
OptionalUser = Annotated[SessionInfo | None, Depends(get_optional_user)]


def require_role(*allowed_roles: Role | str) -> Callable[..., Coroutine[Any, Any, SessionInfo]]:
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


def require_min_role(min_role: Role | str) -> Callable[..., Coroutine[Any, Any, SessionInfo]]:
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
RequireUser = Depends(require_role(Role.USER))  # Exactly user role (not admin/owner)
