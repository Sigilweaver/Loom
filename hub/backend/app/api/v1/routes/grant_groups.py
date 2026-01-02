"""Grant Groups management routes.

Grant Groups are permission bundles that contain grants (connections, etc.).
User Groups reference Grant Groups to give their members access to resources.

This separation enables:
- Reusable permission bundles across teams
- Single audit path: User -> User Group -> Grant Group -> Grant
- No cycles possible (Grant Groups cannot reference other groups)
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import RequireAdmin, RequireAuditor
from app.db.database import get_db
from app.db.models import (
    Connection,
    GrantGroup,
    GrantGroupConnection,
    Group,
    UserGroupGrantGroup,
)
from app.domain.auth.sessions import SessionInfo

router = APIRouter(prefix="/grant-groups", tags=["grant-groups"])
logger = logging.getLogger(__name__)


# =============================================================================
# Request/Response Models
# =============================================================================


class GrantGroupCreate(BaseModel):
    """Request to create a new grant group."""

    name: str = Field(..., min_length=1, max_length=100, description="Grant group name (unique)")
    description: str = Field("", max_length=1000, description="Grant group description")


class GrantGroupUpdate(BaseModel):
    """Request to update a grant group."""

    name: str | None = Field(None, min_length=1, max_length=100, description="New name")
    description: str | None = Field(None, max_length=1000, description="New description")


class GrantGroupSummary(BaseModel):
    """Grant group summary for list views."""

    id: UUID
    name: str
    description: str
    connection_count: int
    user_group_count: int
    created_by: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class GrantGroupListResponse(BaseModel):
    """List of grant groups."""

    grant_groups: list[GrantGroupSummary]
    total: int


class ConnectionSummary(BaseModel):
    """Connection summary within a grant group."""

    connection_id: UUID
    name: str
    type: str
    assigned_at: str
    assigned_by: str


class UserGroupSummary(BaseModel):
    """User group summary within a grant group."""

    user_group_id: UUID
    user_group_name: str
    description: str
    member_count: int
    assigned_at: str
    assigned_by: str


class GrantGroupDetail(BaseModel):
    """Detailed grant group with contents."""

    id: UUID
    name: str
    description: str
    connection_count: int
    user_group_count: int
    created_by: str
    created_at: str
    updated_at: str
    connections: list[ConnectionSummary]
    user_groups: list[UserGroupSummary]


# =============================================================================
# Helper Functions
# =============================================================================


def _grant_group_to_summary(grant_group: GrantGroup) -> GrantGroupSummary:
    """Convert GrantGroup model to summary response."""
    return GrantGroupSummary(
        id=grant_group.id,
        name=grant_group.name,
        description=grant_group.description,
        connection_count=len(grant_group.connections) if grant_group.connections else 0,
        user_group_count=len(grant_group.user_groups) if grant_group.user_groups else 0,
        created_by=grant_group.created_by,
        created_at=grant_group.created_at.isoformat(),
        updated_at=grant_group.updated_at.isoformat(),
    )


# =============================================================================
# Grant Group CRUD Routes
# =============================================================================


@router.get("", response_model=GrantGroupListResponse)
async def list_grant_groups(
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupListResponse:
    """List all grant groups. Requires auditor role or higher."""
    result = await db.execute(
        select(GrantGroup)
        .options(
            selectinload(GrantGroup.connections),
            selectinload(GrantGroup.user_groups),
        )
        .order_by(GrantGroup.name)
    )
    grant_groups = result.scalars().all()

    return GrantGroupListResponse(
        grant_groups=[_grant_group_to_summary(g) for g in grant_groups],
        total=len(grant_groups),
    )


@router.post("", response_model=GrantGroupSummary, status_code=status.HTTP_201_CREATED)
async def create_grant_group(
    request: GrantGroupCreate,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupSummary:
    """Create a new grant group. Requires admin role."""
    # Check for duplicate name
    existing = await db.execute(select(GrantGroup).where(GrantGroup.name == request.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Grant group '{request.name}' already exists",
        )

    grant_group = GrantGroup(
        name=request.name,
        description=request.description,
        created_by=admin.username,
    )
    db.add(grant_group)
    await db.commit()
    await db.refresh(grant_group)

    logger.info(f"Created grant group '{grant_group.name}' by {admin.username}")

    return GrantGroupSummary(
        id=grant_group.id,
        name=grant_group.name,
        description=grant_group.description,
        connection_count=0,
        user_group_count=0,
        created_by=grant_group.created_by,
        created_at=grant_group.created_at.isoformat(),
        updated_at=grant_group.updated_at.isoformat(),
    )


@router.get("/{grant_group_id}", response_model=GrantGroupDetail)
async def get_grant_group(
    grant_group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupDetail:
    """Get grant group details with contents. Requires auditor role or higher."""
    result = await db.execute(
        select(GrantGroup)
        .where(GrantGroup.id == grant_group_id)
        .options(
            selectinload(GrantGroup.connections).selectinload(GrantGroupConnection.connection),
            selectinload(GrantGroup.user_groups)
            .selectinload(UserGroupGrantGroup.user_group)
            .selectinload(Group.members),
        )
    )
    grant_group = result.scalar_one_or_none()

    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    connections = [
        ConnectionSummary(
            connection_id=gc.connection.id,
            name=gc.connection.name,
            type=gc.connection.type,
            assigned_at=gc.assigned_at.isoformat(),
            assigned_by=gc.assigned_by,
        )
        for gc in grant_group.connections
    ]
    user_groups = [
        UserGroupSummary(
            user_group_id=ugg.user_group.id,
            user_group_name=ugg.user_group.name,
            description=ugg.user_group.description,
            member_count=len(ugg.user_group.members) if ugg.user_group.members else 0,
            assigned_at=ugg.assigned_at.isoformat(),
            assigned_by=ugg.assigned_by,
        )
        for ugg in grant_group.user_groups
    ]

    return GrantGroupDetail(
        id=grant_group.id,
        name=grant_group.name,
        description=grant_group.description,
        connection_count=len(connections),
        user_group_count=len(user_groups),
        created_by=grant_group.created_by,
        created_at=grant_group.created_at.isoformat(),
        updated_at=grant_group.updated_at.isoformat(),
        connections=connections,
        user_groups=user_groups,
    )


@router.patch("/{grant_group_id}", response_model=GrantGroupSummary)
async def update_grant_group(
    grant_group_id: UUID,
    request: GrantGroupUpdate,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupSummary:
    """Update a grant group. Requires admin role."""
    result = await db.execute(
        select(GrantGroup)
        .where(GrantGroup.id == grant_group_id)
        .options(
            selectinload(GrantGroup.connections),
            selectinload(GrantGroup.user_groups),
        )
    )
    grant_group = result.scalar_one_or_none()

    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    if request.name is not None:
        # Check for duplicate name
        existing = await db.execute(
            select(GrantGroup).where(
                GrantGroup.name == request.name, GrantGroup.id != grant_group_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Grant group '{request.name}' already exists",
            )
        grant_group.name = request.name

    if request.description is not None:
        grant_group.description = request.description

    await db.commit()
    await db.refresh(grant_group)

    logger.info(f"Updated grant group '{grant_group.name}'")

    return _grant_group_to_summary(grant_group)


@router.delete("/{grant_group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grant_group(
    grant_group_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a grant group. Requires admin role."""
    result = await db.execute(select(GrantGroup).where(GrantGroup.id == grant_group_id))
    grant_group = result.scalar_one_or_none()

    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    logger.info(f"Deleting grant group '{grant_group.name}'")
    await db.delete(grant_group)
    await db.commit()


# =============================================================================
# Connection Assignment Routes
# =============================================================================


class GrantGroupConnectionsResponse(BaseModel):
    """Connections in a grant group."""

    grant_group_id: UUID
    grant_group_name: str
    connections: list[ConnectionSummary]
    total: int


@router.get("/{grant_group_id}/connections", response_model=GrantGroupConnectionsResponse)
async def list_grant_group_connections(
    grant_group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupConnectionsResponse:
    """List connections in a grant group. Requires auditor role or higher."""
    result = await db.execute(
        select(GrantGroup)
        .where(GrantGroup.id == grant_group_id)
        .options(selectinload(GrantGroup.connections).selectinload(GrantGroupConnection.connection))
    )
    grant_group = result.scalar_one_or_none()

    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    connections = [
        ConnectionSummary(
            connection_id=gc.connection.id,
            name=gc.connection.name,
            type=gc.connection.type,
            assigned_at=gc.assigned_at.isoformat(),
            assigned_by=gc.assigned_by,
        )
        for gc in grant_group.connections
    ]

    return GrantGroupConnectionsResponse(
        grant_group_id=grant_group.id,
        grant_group_name=grant_group.name,
        connections=connections,
        total=len(connections),
    )


@router.post("/{grant_group_id}/connections/{connection_id}", status_code=status.HTTP_201_CREATED)
async def add_connection_to_grant_group(
    grant_group_id: UUID,
    connection_id: UUID,
    admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a connection to a grant group. Requires admin role."""
    # Verify grant group exists
    grant_group = await db.get(GrantGroup, grant_group_id)
    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    # Verify connection exists
    connection = await db.get(Connection, connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )

    # Check if already assigned
    existing = await db.execute(
        select(GrantGroupConnection).where(
            GrantGroupConnection.grant_group_id == grant_group_id,
            GrantGroupConnection.connection_id == connection_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Connection '{connection.name}' is already in grant group '{grant_group.name}'",
        )

    # Add assignment
    assignment = GrantGroupConnection(
        grant_group_id=grant_group_id,
        connection_id=connection_id,
        assigned_by=admin.username,
    )
    db.add(assignment)
    await db.commit()

    logger.info(f"Added connection '{connection.name}' to grant group '{grant_group.name}'")

    return {
        "status": "assigned",
        "grant_group_id": str(grant_group_id),
        "connection_id": str(connection_id),
    }


@router.delete(
    "/{grant_group_id}/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_connection_from_grant_group(
    grant_group_id: UUID,
    connection_id: UUID,
    _admin: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a connection from a grant group. Requires admin role."""
    result = await db.execute(
        select(GrantGroupConnection).where(
            GrantGroupConnection.grant_group_id == grant_group_id,
            GrantGroupConnection.connection_id == connection_id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} is not in grant group {grant_group_id}",
        )

    await db.delete(assignment)
    await db.commit()

    logger.info(f"Removed connection {connection_id} from grant group {grant_group_id}")


# =============================================================================
# User Group Assignment Routes
# =============================================================================


class GrantGroupUserGroupsResponse(BaseModel):
    """User groups assigned to a grant group."""

    grant_group_id: UUID
    grant_group_name: str
    user_groups: list[UserGroupSummary]
    total: int


@router.get("/{grant_group_id}/user-groups", response_model=GrantGroupUserGroupsResponse)
async def list_grant_group_user_groups(
    grant_group_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> GrantGroupUserGroupsResponse:
    """List user groups that reference this grant group. Requires auditor role or higher.

    This is a read-only endpoint. To assign grant groups to user groups, use
    POST /groups/{group_id}/grant-groups/{grant_group_id}
    """
    result = await db.execute(
        select(GrantGroup)
        .where(GrantGroup.id == grant_group_id)
        .options(
            selectinload(GrantGroup.user_groups)
            .selectinload(UserGroupGrantGroup.user_group)
            .selectinload(Group.members)
        )
    )
    grant_group = result.scalar_one_or_none()

    if not grant_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grant group {grant_group_id} not found",
        )

    user_groups = [
        UserGroupSummary(
            user_group_id=ugg.user_group.id,
            user_group_name=ugg.user_group.name,
            description=ugg.user_group.description,
            member_count=len(ugg.user_group.members) if ugg.user_group.members else 0,
            assigned_at=ugg.assigned_at.isoformat(),
            assigned_by=ugg.assigned_by,
        )
        for ugg in grant_group.user_groups
    ]

    return GrantGroupUserGroupsResponse(
        grant_group_id=grant_group.id,
        grant_group_name=grant_group.name,
        user_groups=user_groups,
        total=len(user_groups),
    )
