"""Groups management routes (API v1).

Groups are organizational units for access control. Admins create groups
to organize users and scope resource access (connections, workflows, etc.).

Note: Member management (adding/removing users) is handled via /users/{id}/groups
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, RequireAdmin, RequireAuditor
from app.db.database import get_db
from app.db.models import (
    GrantGroup,
    Group,
    User,
    UserGroup,
    UserGroupGrantGroup,
)
from app.domain.auth.roles import Role, get_role_level
from app.domain.auth.sessions import SessionInfo

router = APIRouter(prefix="/groups", tags=["groups"])
logger = logging.getLogger(__name__)


# =============================================================================
# Request/Response Models
# =============================================================================


class GroupCreate(BaseModel):
    """Request to create a new group."""

    name: str = Field(..., min_length=1, max_length=100, description="Group name (unique)")
    description: str = Field("", max_length=1000, description="Group description")


class GroupUpdate(BaseModel):
    """Request to update a group."""

    name: str | None = Field(None, min_length=1, max_length=100, description="New group name")
    description: str | None = Field(None, max_length=1000, description="New description")


class GroupResponse(BaseModel):
    """Group details."""

    id: UUID
    name: str
    description: str
    member_count: int
    grant_group_count: int
    created_by: str
    created_at: str

    model_config = {"from_attributes": True}


class GroupListResponse(BaseModel):
    """List of groups."""

    groups: list[GroupResponse]
    total: int


class GroupMemberResponse(BaseModel):
    """User member of a group."""

    user_id: UUID
    username: str
    role: str
    joined_at: str


class GroupMembersResponse(BaseModel):
    """Members of a group."""

    group_id: UUID
    group_name: str
    members: list[GroupMemberResponse]
    total: int


# =============================================================================
# Helper Functions
# =============================================================================


def _group_to_response(group: Group) -> GroupResponse:
    """Convert Group model to response."""
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=len(group.members) if group.members else 0,
        grant_group_count=len(group.grant_groups) if group.grant_groups else 0,
        created_by=group.created_by,
        created_at=group.created_at.isoformat(),
    )


# =============================================================================
# Group CRUD Routes
# =============================================================================


@router.get("", response_model=GroupListResponse)
async def list_groups(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> GroupListResponse:
    """List groups.

    For regular users: Returns groups the user belongs to.
    For Auditor+: Returns all groups.
    """
    auditor_level = get_role_level(Role.AUDITOR)
    user_level = get_role_level(current_user.role)

    if user_level > auditor_level:
        # Regular users: filter by membership
        result = await db.execute(
            select(Group)
            .join(UserGroup)
            .options(selectinload(Group.members), selectinload(Group.grant_groups))
            .where(UserGroup.user_id == current_user.user_id)
            .order_by(Group.name)
        )
    else:
        # Auditor+: see all groups
        result = await db.execute(
            select(Group)
            .options(selectinload(Group.members), selectinload(Group.grant_groups))
            .order_by(Group.name)
        )

    groups = result.scalars().all()

    return GroupListResponse(
        groups=[_group_to_response(g) for g in groups],
        total=len(groups),
    )


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: GroupCreate,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Create a new group. Requires admin role."""
    # Check for duplicate name
    existing = await db.execute(select(Group).where(Group.name == request.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Group '{request.name}' already exists",
        )

    group = Group(
        name=request.name,
        description=request.description,
        created_by=admin.username,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    logger.info(f"Created group '{group.name}' by {admin.username}")

    # New groups have no members or grant groups, return counts as 0
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=0,
        grant_group_count=0,
        created_by=group.created_by,
        created_at=group.created_at.isoformat(),
    )


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Get group details. Requires auditor role or higher."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members), selectinload(Group.grant_groups))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    return _group_to_response(group)


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    request: GroupUpdate,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Update a group. Requires admin role."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members), selectinload(Group.grant_groups))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    if request.name is not None:
        # Check for duplicate name
        existing = await db.execute(
            select(Group).where(Group.name == request.name, Group.id != group_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Group '{request.name}' already exists",
            )
        group.name = request.name

    if request.description is not None:
        group.description = request.description

    await db.commit()
    await db.refresh(group)

    logger.info(f"Updated group '{group.name}'")

    return _group_to_response(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a group. Requires admin role."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    logger.info(f"Deleting group '{group.name}'")
    await db.delete(group)
    await db.commit()


# =============================================================================
# Group Members Routes (read-only, write via /users/{id}/groups)
# =============================================================================


@router.get("/{group_id}/members", response_model=GroupMembersResponse)
async def list_group_members(
    group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GroupMembersResponse:
    """List members of a group. Requires auditor role or higher."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members).selectinload(UserGroup.user))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    members = [
        GroupMemberResponse(
            user_id=ug.user.id,
            username=ug.user.username,
            role=ug.user.role,
            joined_at=ug.joined_at.isoformat(),
        )
        for ug in group.members
    ]

    return GroupMembersResponse(
        group_id=group.id,
        group_name=group.name,
        members=members,
        total=len(members),
    )


# =============================================================================
# Group Grant Groups Routes (User Group -> Grant Group assignment)
# =============================================================================


class GroupGrantGroupResponse(BaseModel):
    """Grant group assigned to a user group."""

    grant_group_id: UUID
    grant_group_name: str
    connection_count: int
    assigned_at: str


class GroupGrantGroupsResponse(BaseModel):
    """Grant groups assigned to a user group."""

    group_id: UUID
    group_name: str
    grant_groups: list[GroupGrantGroupResponse]
    total: int


@router.get("/{group_id}/grant-groups", response_model=GroupGrantGroupsResponse)
async def list_group_grant_groups(
    group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GroupGrantGroupsResponse:
    """List grant groups assigned to a user group. Requires auditor role or higher."""
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.grant_groups)
            .selectinload(UserGroupGrantGroup.grant_group)
            .selectinload(GrantGroup.connections)
        )
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    grant_groups = [
        GroupGrantGroupResponse(
            grant_group_id=ugg.grant_group.id,
            grant_group_name=ugg.grant_group.name,
            connection_count=len(ugg.grant_group.connections) if ugg.grant_group.connections else 0,
            assigned_at=ugg.assigned_at.isoformat(),
        )
        for ugg in group.grant_groups
    ]

    return GroupGrantGroupsResponse(
        group_id=group.id,
        group_name=group.name,
        grant_groups=grant_groups,
        total=len(grant_groups),
    )


@router.post("/{group_id}/grant-groups/{grant_group_id}", status_code=status.HTTP_201_CREATED)
async def assign_grant_group_to_group(
    group_id: UUID,
    grant_group_id: UUID,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Assign a grant group to a user group. Requires admin role."""
    # Verify user group exists
    user_group = await db.get(Group, group_id)
    if not user_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    # Verify grant group exists
    grant_group = await db.get(GrantGroup, grant_group_id)
    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    # Check if already assigned
    existing = await db.execute(
        select(UserGroupGrantGroup).where(
            UserGroupGrantGroup.user_group_id == group_id,
            UserGroupGrantGroup.grant_group_id == grant_group_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Grant group '{grant_group.name}' is already assigned to '{user_group.name}'",
        )

    # Add assignment
    assignment = UserGroupGrantGroup(
        user_group_id=group_id,
        grant_group_id=grant_group_id,
        assigned_by=admin.username,
    )
    db.add(assignment)
    await db.commit()

    logger.info(f"Assigned grant group '{grant_group.name}' to group '{user_group.name}'")

    return {
        "status": "assigned",
        "group_id": str(group_id),
        "grant_group_id": str(grant_group_id),
    }


@router.delete("/{group_id}/grant-groups/{grant_group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_grant_group_from_group(
    group_id: UUID,
    grant_group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a grant group from a user group. Requires admin role."""
    result = await db.execute(
        select(UserGroupGrantGroup).where(
            UserGroupGrantGroup.user_group_id == group_id,
            UserGroupGrantGroup.grant_group_id == grant_group_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} is not assigned to group {group_id}",
        )

    await db.delete(assignment)
    await db.commit()

    logger.info(f"Removed grant group {grant_group_id} from group {group_id}")
