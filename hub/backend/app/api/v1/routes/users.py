"""User management routes (API v1)"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, RequireAdmin, RequireAuditor
from app.db.database import get_db
from app.db.models import Group, User, UserGroup
from app.domain.auth.password import hash_password
from app.domain.auth.roles import Role, can_assign_role, can_manage_role
from app.domain.auth.sessions import SessionInfo

router = APIRouter(prefix="/users")


# Request/Response models


class UserResponse(BaseModel):
    """User info response"""

    id: UUID
    username: str
    role: str
    created_at: str


class UserListResponse(BaseModel):
    """List of users response"""

    users: list[UserResponse]
    total: int


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


class UserGroupResponse(BaseModel):
    """Group membership info"""

    id: UUID
    name: str
    description: str | None


class UserGroupListResponse(BaseModel):
    """List of groups the user belongs to"""

    groups: list[UserGroupResponse]
    total: int


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


async def _get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Get user by username"""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


# Routes


@router.get("", response_model=UserListResponse)
async def list_users(
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    """List all users. Requires auditor role or higher."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()

    return UserListResponse(
        users=[_user_to_response(u) for u in users],
        total=len(users),
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Get a single user by ID. Requires auditor role or higher."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _user_to_response(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create a new user with specified role. Requires admin role or higher."""
    # Validate actor can assign the requested role
    if not can_assign_role(_admin.role, request.role):
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


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UpdateUserRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update a user's username, password, and/or role.

    Requires admin role or higher.
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

    # Cannot update yourself via this endpoint (use PATCH /auth/me instead)
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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a user.

    Requires admin role or higher.
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


# User group membership routes (moved from groups.py)


@router.get("/{user_id}/groups", response_model=UserGroupListResponse)
async def list_user_groups(
    user_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> UserGroupListResponse:
    """List groups that a user belongs to. Requires auditor role or higher."""
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Get groups for this user
    result = await db.execute(
        select(Group)
        .join(UserGroup)
        .where(UserGroup.user_id == user_id)
        .order_by(Group.name)
    )
    groups = result.scalars().all()

    return UserGroupListResponse(
        groups=[
            UserGroupResponse(id=g.id, name=g.name, description=g.description) for g in groups
        ],
        total=len(groups),
    )


@router.post("/{user_id}/groups/{group_id}", status_code=status.HTTP_201_CREATED)
async def add_user_to_group(
    user_id: UUID,
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Add a user to a group. Requires admin role or higher.

    Only regular users can be added to groups.
    Owners, admins, and auditors cannot be group members.
    """
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Only regular users can be added to groups
    if user.role != Role.USER.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add {user.role} to a group. Only regular users can be group members.",
        )

    # Verify group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Check if already a member
    result = await db.execute(
        select(UserGroup).where(UserGroup.user_id == user_id, UserGroup.group_id == group_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this group",
        )

    # Add membership
    membership = UserGroup(user_id=user_id, group_id=group_id)
    db.add(membership)
    await db.commit()

    return MessageResponse(message="User added to group")


@router.delete("/{user_id}/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_from_group(
    user_id: UUID,
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a user from a group. Requires admin role or higher."""
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Find and delete membership
    result = await db.execute(
        select(UserGroup).where(UserGroup.user_id == user_id, UserGroup.group_id == group_id)
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group",
        )

    await db.delete(membership)
    await db.commit()
