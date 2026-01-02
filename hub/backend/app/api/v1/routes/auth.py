"""Authentication routes (API v1)"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_optional_user
from app.db.database import get_db
from app.db.models import User
from app.domain.auth.password import hash_password, verify_password
from app.domain.auth.roles import Role
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

    id: str  # UUID as string
    username: str
    role: str
    created_at: str


class UpdateProfileRequest(BaseModel):
    """Request to update own profile (requires re-authentication)"""

    current_password: str = Field(..., description="Current password for verification")
    username: str | None = Field(None, min_length=3, max_length=255, description="New username")
    new_password: str | None = Field(None, min_length=8, max_length=128, description="New password")


class MessageResponse(BaseModel):
    """Simple message response"""

    message: str


class AuthStatusResponse(BaseModel):
    """Authentication system status"""

    initialized: bool
    registration_open: bool
    user_count: int


# Helper functions


def _user_to_response(user: User) -> UserResponse:
    """Convert User model to response"""
    return UserResponse(
        id=str(user.id),
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


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)) -> AuthStatusResponse:
    """Check authentication system status.

    Returns whether the system has been initialized (has users)
    and whether registration is open (first user not yet created).
    """
    user_count = await _get_user_count(db)

    return AuthStatusResponse(
        initialized=user_count > 0,
        registration_open=user_count == 0,
        user_count=user_count,
    )
