"""Groups management routes.

Groups are organizational units for access control. Admins create groups
to organize users and scope resource access (connections, workflows, etc.).
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, RequireAdmin
from app.db.database import get_db
from app.db.models import Connection, ConnectionGroup, Group, User, UserGroup
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
    connection_count: int
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


class GroupConnectionResponse(BaseModel):
    """Connection assigned to a group."""

    connection_id: UUID
    name: str
    type: str
    assigned_at: str


class GroupConnectionsResponse(BaseModel):
    """Connections assigned to a group."""

    group_id: UUID
    group_name: str
    connections: list[GroupConnectionResponse]
    total: int


class AddMemberRequest(BaseModel):
    """Request to add a user to a group."""

    user_id: UUID = Field(..., description="User ID to add")


class AddConnectionRequest(BaseModel):
    """Request to assign a connection to a group."""

    connection_id: UUID = Field(..., description="Connection ID to assign")


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
        connection_count=len(group.connections) if group.connections else 0,
        created_by=group.created_by,
        created_at=group.created_at.isoformat(),
    )


# =============================================================================
# Group CRUD Routes
# =============================================================================


@router.get("", response_model=GroupListResponse)
async def list_groups(
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupListResponse:
    """List all groups. Requires admin role."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members), selectinload(Group.connections))
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

    return _group_to_response(group)


# =============================================================================
# User's Groups (self-service) - MUST be before /{group_id} routes
# =============================================================================


@router.get("/my", response_model=GroupListResponse)
async def list_my_groups(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> GroupListResponse:
    """List groups the current user belongs to."""
    result = await db.execute(
        select(Group)
        .join(UserGroup)
        .options(selectinload(Group.members), selectinload(Group.connections))
        .where(UserGroup.user_id == current_user.user_id)
        .order_by(Group.name)
    )
    groups = result.scalars().all()

    return GroupListResponse(
        groups=[_group_to_response(g) for g in groups],
        total=len(groups),
    )


# =============================================================================
# Group CRUD (by ID)
# =============================================================================


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Get group details. Requires admin role."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members), selectinload(Group.connections))
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
        .options(selectinload(Group.members), selectinload(Group.connections))
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
# Group Members Routes
# =============================================================================


@router.get("/{group_id}/members", response_model=GroupMembersResponse)
async def list_group_members(
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupMembersResponse:
    """List members of a group. Requires admin role."""
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


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_group_member(
    group_id: UUID,
    request: AddMemberRequest,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a user to a group. Requires admin role."""
    # Check group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    # Check user exists
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {request.user_id} not found",
        )

    # Check if already a member
    result = await db.execute(
        select(UserGroup).where(
            UserGroup.user_id == request.user_id,
            UserGroup.group_id == group_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User {user.username} is already a member of {group.name}",
        )

    # Add membership
    membership = UserGroup(user_id=request.user_id, group_id=group_id)
    db.add(membership)
    await db.commit()

    logger.info(f"Added user '{user.username}' to group '{group.name}'")

    return {"status": "added", "user_id": str(request.user_id), "group_id": str(group_id)}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group_member(
    group_id: UUID,
    user_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a user from a group. Requires admin role."""
    result = await db.execute(
        select(UserGroup).where(
            UserGroup.user_id == user_id,
            UserGroup.group_id == group_id,
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} is not a member of group {group_id}",
        )

    await db.delete(membership)
    await db.commit()

    logger.info(f"Removed user {user_id} from group {group_id}")


# =============================================================================
# Group Connections Routes
# =============================================================================


@router.get("/{group_id}/connections", response_model=GroupConnectionsResponse)
async def list_group_connections(
    group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GroupConnectionsResponse:
    """List connections assigned to a group. Requires admin role."""
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.connections).selectinload(ConnectionGroup.connection))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    connections = [
        GroupConnectionResponse(
            connection_id=cg.connection.id,
            name=cg.connection.name,
            type=cg.connection.type,
            assigned_at=cg.assigned_at.isoformat(),
        )
        for cg in group.connections
    ]

    return GroupConnectionsResponse(
        group_id=group.id,
        group_name=group.name,
        connections=connections,
        total=len(connections),
    )


@router.post("/{group_id}/connections", status_code=status.HTTP_201_CREATED)
async def add_group_connection(
    group_id: UUID,
    request: AddConnectionRequest,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Assign a connection to a group. Requires admin role."""
    # Check group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )

    # Check connection exists
    result = await db.execute(select(Connection).where(Connection.id == request.connection_id))
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {request.connection_id} not found",
        )

    # Check if already assigned
    result = await db.execute(
        select(ConnectionGroup).where(
            ConnectionGroup.connection_id == request.connection_id,
            ConnectionGroup.group_id == group_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Connection {connection.name} is already assigned to {group.name}",
        )

    # Add assignment
    assignment = ConnectionGroup(connection_id=request.connection_id, group_id=group_id)
    db.add(assignment)
    await db.commit()

    logger.info(f"Assigned connection '{connection.name}' to group '{group.name}'")

    return {
        "status": "assigned",
        "connection_id": str(request.connection_id),
        "group_id": str(group_id),
    }


@router.delete("/{group_id}/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group_connection(
    group_id: UUID,
    connection_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a connection from a group. Requires admin role."""
    result = await db.execute(
        select(ConnectionGroup).where(
            ConnectionGroup.connection_id == connection_id,
            ConnectionGroup.group_id == group_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} is not assigned to group {group_id}",
        )

    await db.delete(assignment)
    await db.commit()

    logger.info(f"Removed connection {connection_id} from group {group_id}")
