"""Authentication routes"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_optional_user
from app.db.database import get_db
from app.db.models import User
from app.domain.auth.password import hash_password, verify_password
from app.domain.auth.roles import Role, can_assign_role, can_manage_role
from app.domain.auth.sessions import SessionInfo, SessionManager

router = APIRouter(prefix="/auth")


# Request/Response models


class RegisterRequest(BaseModel):
    """Registration request body"""

    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Login request body"""

    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with access token"""

    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    """User info response"""

    id: UUID
    username: str
    role: str
    created_at: str


class CreateUserRequest(BaseModel):
    """Request to create a new user (admin only)"""

    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default=Role.USER.value)


class UpdateUserRequest(BaseModel):
    """Request to update a user (admin only)"""

    username: str | None = Field(None, min_length=3, max_length=255, description="New username")
    password: str | None = Field(None, min_length=8, max_length=128, description="New password")
    role: str | None = Field(None, description="New role for the user")


class UpdateProfileRequest(BaseModel):
    """Request to update own profile (requires re-authentication)"""

    current_password: str = Field(..., description="Current password for verification")
    username: str | None = Field(None, min_length=3, max_length=255, description="New username")
    new_password: str | None = Field(None, min_length=8, max_length=128, description="New password")


class MessageResponse(BaseModel):
    """Simple message response"""

    message: str


# Helper functions


def _user_to_response(user: User) -> UserResponse:
    """Convert User model to response"""
    return UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


async def _get_user_count(db: AsyncSession) -> int:
    """Get total number of users in database"""
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar() or 0


async def _get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Get user by username"""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


# Routes


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: SessionInfo | None = Depends(get_optional_user),
) -> LoginResponse:
    """Register a new user.

    The first user to register becomes the owner with full control.
    Subsequent registrations require an authenticated admin or owner.
    """
    # Check if this is the first user (will become owner)
    user_count = await _get_user_count(db)
    is_first_user = user_count == 0

    if not is_first_user:
        # Require authentication for subsequent registrations
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to create new users",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Only owner and admin can create users
        if current_user.role not in (Role.OWNER.value, Role.ADMIN.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create users",
            )

    # Check if username already exists
    existing_user = await _get_user_by_username(db, request.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # Determine role
    role = Role.OWNER.value if is_first_user else Role.USER.value

    # Create user
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create session for the new user
    session_manager = SessionManager(db)
    token = await session_manager.create_session(
        user=user,
        user_agent=http_request.headers.get("User-Agent"),
        ip_address=http_request.client.host if http_request.client else None,
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_response(user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate user and return access token"""
    # Find user
    user = await _get_user_by_username(db, request.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Verify password
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Update last login
    user.last_login = datetime.now(UTC)
    await db.commit()

    # Create session
    session_manager = SessionManager(db)
    token = await session_manager.create_session(
        user=user,
        user_agent=http_request.headers.get("User-Agent"),
        ip_address=http_request.client.host if http_request.client else None,
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_response(user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Logout current user by invalidating session"""
    # Extract token from header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return MessageResponse(message="No session to invalidate")

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return MessageResponse(message="No session to invalidate")

    token = parts[1]

    # Invalidate session
    session_manager = SessionManager(db)
    invalidated = await session_manager.invalidate_session(token)

    if invalidated:
        return MessageResponse(message="Logged out successfully")
    return MessageResponse(message="Session not found or already expired")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Get current user info"""
    # Fetch full user from database for latest data
    db_user = await _get_user_by_username(db, user.username)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _user_to_response(db_user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update own profile (username and/or password).

    Requires re-authentication with current password.
    Any user including owner can update their own profile.
    """
    # Fetch current user from database
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify current password
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    # Check if at least one field is being updated
    if request.username is None and request.new_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes provided. Specify username or new_password.",
        )

    # Update username if provided
    if request.username is not None and request.username != user.username:
        # Check if new username already exists
        existing = await _get_user_by_username(db, request.username)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        user.username = request.username

    # Update password if provided
    if request.new_password is not None:
        user.password_hash = hash_password(request.new_password)

    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)


@router.get("/users")
async def list_users(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all users (auditor or higher)."""
    # Owner, admin, and auditor can list users
    if current_user.role not in (Role.OWNER.value, Role.ADMIN.value, Role.AUDITOR.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to list users",
        )

    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()

    return {
        "users": [_user_to_response(u) for u in users],
        "total": len(users),
    }


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Get a single user by ID (auditor or higher)."""
    # Owner, admin, and auditor can view users
    if current_user.role not in (Role.OWNER.value, Role.ADMIN.value, Role.AUDITOR.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view user",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _user_to_response(user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create a new user with specified role (admin only).

    This endpoint allows admins to create users with specific roles,
    unlike /register which creates standard users.
    """
    # Validate actor can create users
    if current_user.role not in (Role.OWNER.value, Role.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create users",
        )

    # Validate actor can assign the requested role
    if not can_assign_role(current_user.role, request.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot assign role '{request.role}'",
        )

    # Validate role is valid
    valid_roles = {r.value for r in Role}
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Check if username already exists
    existing_user = await _get_user_by_username(db, request.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # Create user
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role=request.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UpdateUserRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update a user's username, password, and/or role (admin only).

    Users cannot update themselves or users with equal/higher privileges.
    """
    # Find the user to update
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Cannot update yourself via this endpoint (use PATCH /me instead)
    if target_user.id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update your own account via this endpoint. Use PATCH /auth/me instead.",
        )

    # Check permission to manage this user's current role
    if not can_manage_role(current_user.role, target_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update this user",
        )

    # Check if at least one field is being updated
    if request.username is None and request.password is None and request.role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes provided. Specify username, password, or role.",
        )

    # Update username if provided
    if request.username is not None and request.username != target_user.username:
        # Check if new username already exists
        existing = await _get_user_by_username(db, request.username)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        target_user.username = request.username

    # Update password if provided
    if request.password is not None:
        target_user.password_hash = hash_password(request.password)

    # Update role if provided
    if request.role is not None:
        # Validate role is valid
        valid_roles = {r.value for r in Role}
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
            )

        # Validate actor can assign the new role
        if not can_assign_role(current_user.role, request.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot assign role '{request.role}'",
            )

        target_user.role = request.role

    await db.commit()
    await db.refresh(target_user)

    return _user_to_response(target_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a user (admin only).

    Users cannot delete themselves or users with equal/higher privileges.
    """
    # Find the user to delete
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Cannot delete yourself
    if target_user.id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    # Check permission to manage this user's role
    if not can_manage_role(current_user.role, target_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete this user",
        )

    # Delete the user (sessions will cascade delete)
    await db.delete(target_user)
    await db.commit()


@router.get("/status")
async def auth_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Check authentication system status.

    Returns whether the system has been initialized (has users)
    and whether registration is open (first user not yet created).
    """
    user_count = await _get_user_count(db)

    return {
        "initialized": user_count > 0,
        "registration_open": user_count == 0,
        "user_count": user_count,
    }

