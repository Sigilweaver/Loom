"""Connection management API routes.

Admin-only endpoints for managing Hub connections (database, filesystem).
Database connections store encrypted credentials.
"""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAdmin
from app.db.database import get_db
from app.db.models import GrantGroupConnection, UserGroup, UserGroupGrantGroup
from app.domain.auth.sessions import SessionInfo
from app.domain.connections import (
    ConnectionInfo,
    ConnectionNotFoundError,
    ConnectionStore,
    ConnectionType,
    CreateConnectionInput,
    DatabaseConfig,
    DatabaseType,
    DuplicateConnectionError,
    EncryptionKeyError,
    FilesystemConfig,
    PathType,
    ResolvedDatabaseConnection,
    UpdateConnectionInput,
)

router = APIRouter(prefix="/connections", tags=["connections"])
logger = logging.getLogger(__name__)


# Response models


class DatabaseConfigResponse(BaseModel):
    """Database-specific configuration."""

    db_type: str
    host: str
    port: int
    database: str


class FilesystemConfigResponse(BaseModel):
    """Filesystem-specific configuration."""

    path: str
    path_type: str


class ConnectionResponse(BaseModel):
    """Connection details (without credentials)."""

    id: str
    name: str
    type: str
    description: str | None
    read_only: bool
    status: str
    last_checked: str | None
    last_healthy: str | None
    last_error: str | None
    created_by: str
    created_at: str
    updated_at: str
    # Type-specific configs (only one will be present)
    database_config: DatabaseConfigResponse | None = None
    filesystem_config: FilesystemConfigResponse | None = None


class ConnectionListResponse(BaseModel):
    """List of connections."""

    connections: list[ConnectionResponse]
    total: int


class TestConnectionResponse(BaseModel):
    """Response from testing a connection."""

    success: bool
    message: str


def _info_to_response(info: ConnectionInfo) -> ConnectionResponse:
    """Convert ConnectionInfo to API response."""
    database_config = None
    filesystem_config = None

    if info.database_config:
        database_config = DatabaseConfigResponse(
            db_type=info.database_config.db_type.value if isinstance(info.database_config.db_type, DatabaseType) else info.database_config.db_type,
            host=info.database_config.host,
            port=info.database_config.port,
            database=info.database_config.database,
        )

    if info.filesystem_config:
        filesystem_config = FilesystemConfigResponse(
            path=info.filesystem_config.path,
            path_type=info.filesystem_config.path_type.value if isinstance(info.filesystem_config.path_type, PathType) else info.filesystem_config.path_type,
        )

    return ConnectionResponse(
        id=info.id,
        name=info.name,
        type=info.type if isinstance(info.type, str) else info.type.value,
        description=info.description,
        read_only=info.read_only,
        status=info.status,
        last_checked=info.last_checked.isoformat() if info.last_checked else None,
        last_healthy=info.last_healthy.isoformat() if info.last_healthy else None,
        last_error=info.last_error,
        created_by=info.created_by,
        created_at=info.created_at.isoformat(),
        updated_at=info.updated_at.isoformat(),
        database_config=database_config,
        filesystem_config=filesystem_config,
    )


async def _get_store(db: AsyncSession) -> ConnectionStore:
    """Get the connection store, handling disabled state."""
    try:
        return ConnectionStore(db)
    except EncryptionKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("", response_model=ConnectionListResponse)
async def list_connections(
    user: CurrentUser,
    connection_type: Annotated[ConnectionType | None, Query(alias="type")] = None,
    db: AsyncSession = Depends(get_db),
) -> ConnectionListResponse:
    """List Hub connections accessible to the current user.

    Admins and owners see all connections.
    Regular users only see connections via grant groups:
    User -> UserGroup -> GrantGroup -> Connection
    Credentials are never returned.

    Query params:
        type: Optional filter by connection type ("database" or "filesystem")
    """
    store = await _get_store(db)

    # Admins/Owners/Auditors see all connections
    if user.role in ("owner", "admin", "auditor"):
        connections = await store.list_connections(connection_type=connection_type)
        return ConnectionListResponse(
            connections=[_info_to_response(c) for c in connections],
            total=len(connections),
        )

    # Get accessible connection ids in a single JOIN query:
    #   user_groups -> user_group_grant_groups -> grant_group_connections
    # This replaces three sequential round-trips with one indexed scan.
    accessible_stmt = (
        select(GrantGroupConnection.connection_id)
        .join(
            UserGroupGrantGroup,
            UserGroupGrantGroup.grant_group_id
            == GrantGroupConnection.grant_group_id,
        )
        .join(
            UserGroup,
            UserGroup.group_id == UserGroupGrantGroup.user_group_id,
        )
        .where(UserGroup.user_id == user.user_id)
        .distinct()
    )
    accessible_result = await db.execute(accessible_stmt)
    accessible_conn_ids = {row[0] for row in accessible_result.fetchall()}

    if not accessible_conn_ids:
        return ConnectionListResponse(connections=[], total=0)

    # Filter connections to only those accessible
    all_connections = await store.list_connections(connection_type=connection_type)
    filtered = [
        c for c in all_connections
        if UUID(c.id) in accessible_conn_ids
    ]

    return ConnectionListResponse(
        connections=[_info_to_response(c) for c in filtered],
        total=len(filtered),
    )


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    input: CreateConnectionInput,
    user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ConnectionResponse:
    """Create a new Hub connection.

    Requires admin role. Credentials are encrypted at rest.
    """
    store = await _get_store(db)

    try:
        conn = await store.create_connection(input, created_by=user.username)
        return _info_to_response(conn)
    except DuplicateConnectionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(
    connection_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ConnectionResponse:
    """Get a connection by ID.

    Admins/auditors can view any connection.
    Users can only view connections assigned to their groups via grant groups.
    Credentials are never returned.
    """
    store = await _get_store(db)
    conn = await store.get_connection(connection_id)

    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )

    # Admins/auditors can see any connection
    if user.role in ("owner", "admin", "auditor"):
        return _info_to_response(conn)

    # Users can only see connections via grant groups they have access to
    user_groups_result = await db.execute(
        select(UserGroup.group_id).where(UserGroup.user_id == user.user_id)
    )
    user_group_ids = {row[0] for row in user_groups_result.fetchall()}

    if not user_group_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this connection",
        )

    # Get grant groups assigned to user's groups
    grant_groups_result = await db.execute(
        select(UserGroupGrantGroup.grant_group_id)
        .where(UserGroupGrantGroup.user_group_id.in_(user_group_ids))
        .distinct()
    )
    grant_group_ids = {row[0] for row in grant_groups_result.fetchall()}

    if not grant_group_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this connection",
        )

    # Check if connection is in any of the grant groups
    accessible = await db.execute(
        select(GrantGroupConnection.connection_id)
        .where(GrantGroupConnection.connection_id == connection_id)
        .where(GrantGroupConnection.grant_group_id.in_(grant_group_ids))
    )
    if not accessible.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this connection",
        )

    return _info_to_response(conn)


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: UUID,
    input: UpdateConnectionInput,
    _user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ConnectionResponse:
    """Update an existing connection.

    Requires admin role. Only provided fields are updated.
    Credentials can be updated by providing username/password.
    """
    store = await _get_store(db)

    try:
        conn = await store.update_connection(connection_id, input)
        return _info_to_response(conn)
    except ConnectionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )
    except DuplicateConnectionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: UUID,
    _user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a connection.

    Requires admin role.
    """
    store = await _get_store(db)
    deleted = await store.delete_connection(connection_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )


class HealthCheckResponse(BaseModel):
    """Response from health check operations."""

    status: str
    last_checked: str | None
    last_healthy: str | None
    last_error: str | None


class HealthCheckAllResponse(BaseModel):
    """Response from checking all connections."""

    checked: int
    healthy: int
    unhealthy: int
    error: int


@router.post("/{connection_id}/check", response_model=HealthCheckResponse)
async def check_connection_health(
    connection_id: UUID,
    _user: SessionInfo = RequireAdmin,
) -> HealthCheckResponse:
    """Manually trigger a health check for a connection.

    Requires admin role. Tests the connection and updates its status.
    """
    from app.domain.connections.health_poller import connection_health_poller

    try:
        result = await connection_health_poller.check_single_connection(str(connection_id))
        return HealthCheckResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/check-all", response_model=HealthCheckAllResponse)
async def check_all_connections_health(
    _user: SessionInfo = RequireAdmin,
) -> HealthCheckAllResponse:
    """Manually trigger a health check for all connections.

    Requires admin role. Tests all connections and updates their status.
    """
    from app.domain.connections.health_poller import connection_health_poller

    result = await connection_health_poller.check_all_now()
    return HealthCheckAllResponse(**result)


@router.post("/{connection_id}/test", response_model=TestConnectionResponse)
async def test_connection(
    connection_id: UUID,
    _user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> TestConnectionResponse:
    """Test a database connection by attempting to connect.

    Requires admin role. Decrypts credentials and attempts a connection.
    Only works for database connections.
    """
    store = await _get_store(db)
    resolved = await store.resolve_connection(connection_id)

    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )

    # Only database connections can be tested this way
    if not isinstance(resolved, ResolvedDatabaseConnection):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only database connections can be tested directly. Filesystem connections require a Server for health checks.",
        )

    return _test_connection_params(
        db_type=resolved.db_type,
        host=resolved.host,
        port=resolved.port,
        database=resolved.database,
        username=resolved.username,
        password=resolved.password,
    )


class TestConnectionInput(BaseModel):
    """Input for testing a connection before creation."""

    type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: str


@router.post("/test", response_model=TestConnectionResponse)
async def test_connection_params(
    input: TestConnectionInput,
    _user: SessionInfo = RequireAdmin,
) -> TestConnectionResponse:
    """Test connection parameters before creating a connection.

    Requires admin role. Tests if we can connect with the provided credentials.
    """
    return _test_connection_params(
        db_type=input.type,
        host=input.host,
        port=input.port,
        database=input.database,
        username=input.username,
        password=input.password,
    )


def _test_connection_params(
    db_type: str | DatabaseType,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> TestConnectionResponse:
    """Test connection with provided parameters.

    Uses Polars with connectorx engine for consistency with the Server.
    """
    try:
        from urllib.parse import quote_plus

        import polars as pl

        # URL-encode credentials
        safe_username = quote_plus(username)
        safe_password = quote_plus(password)

        # Convert enum to string if needed
        type_str = db_type if isinstance(db_type, str) else db_type.value

        # Build connection URL based on type
        if type_str == "postgresql":
            url = f"postgresql://{safe_username}:{safe_password}@{host}:{port}/{database}"
        elif type_str == "mysql":
            url = f"mysql://{safe_username}:{safe_password}@{host}:{port}/{database}"
        elif type_str == "mssql":
            url = f"mssql://{safe_username}:{safe_password}@{host}:{port}/{database}"
        elif type_str == "sqlite":
            url = f"sqlite://{database}"
        else:
            return TestConnectionResponse(
                success=False,
                message=f"Connection testing not implemented for type: {type_str}",
            )

        # Execute a simple query to test the connection using Polars + connectorx
        pl.read_database_uri(
            query="SELECT 1",
            uri=url,
            engine="connectorx",
        )

        return TestConnectionResponse(success=True, message="Connection successful")

    except ImportError as e:
        logger.error(f"ImportError: {e}")
        return TestConnectionResponse(
            success=False,
            message=f"Database driver not available: {e}",
        )
    except Exception as e:
        # Sanitize error to not leak credentials
        error_msg = str(e)
        if password and password in error_msg:
            error_msg = error_msg.replace(password, "***")
        if username and username in error_msg:
            error_msg = error_msg.replace(username, "***")
        return TestConnectionResponse(success=False, message=f"Connection failed: {error_msg}")
