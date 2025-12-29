"""Connection management API routes.

Admin-only endpoints for managing Hub database connections.
Connections are stored with encrypted credentials.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAdmin
from app.db.database import get_db
from app.db.models import ConnectionGroup, UserGroup
from app.domain.auth.sessions import SessionInfo
from app.domain.connections import (
    ConnectionInfo,
    ConnectionNotFoundError,
    ConnectionStore,
    CreateConnectionInput,
    DatabaseType,
    DuplicateConnectionError,
    EncryptionKeyError,
    UpdateConnectionInput,
)

router = APIRouter(prefix="/connections", tags=["connections"])
logger = logging.getLogger(__name__)


# Response models


class ConnectionResponse(BaseModel):
    """Connection details (without credentials)."""

    id: str
    name: str
    type: str
    host: str
    port: int
    database: str
    created_by: str
    created_at: str
    updated_at: str


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
    return ConnectionResponse(
        id=info.id,
        name=info.name,
        type=info.type if isinstance(info.type, str) else info.type.value,
        host=info.host,
        port=info.port,
        database=info.database,
        created_by=info.created_by,
        created_at=info.created_at.isoformat(),
        updated_at=info.updated_at.isoformat(),
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
    db: AsyncSession = Depends(get_db),
) -> ConnectionListResponse:
    """List Hub connections accessible to the current user.

    Admins and owners see all connections.
    Regular users only see connections assigned to groups they belong to.
    Credentials are never returned.
    """
    store = await _get_store(db)

    # Admins/Owners see all connections
    if user.role in ("owner", "admin"):
        connections = await store.list_connections()
        return ConnectionListResponse(
            connections=[_info_to_response(c) for c in connections],
            total=len(connections),
        )

    # Get user's group memberships
    user_groups_result = await db.execute(
        select(UserGroup.group_id).where(UserGroup.user_id == user.user_id)
    )
    user_group_ids = {row[0] for row in user_groups_result.fetchall()}

    if not user_group_ids:
        # User not in any groups - no connections accessible
        return ConnectionListResponse(connections=[], total=0)

    # Get connections assigned to user's groups
    accessible_conn_result = await db.execute(
        select(ConnectionGroup.connection_id)
        .where(ConnectionGroup.group_id.in_(user_group_ids))
        .distinct()
    )
    accessible_conn_ids = {row[0] for row in accessible_conn_result.fetchall()}

    if not accessible_conn_ids:
        return ConnectionListResponse(connections=[], total=0)

    # Filter connections to only those accessible
    all_connections = await store.list_connections()
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
    _user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> ConnectionResponse:
    """Get a connection by ID.

    Requires admin role. Credentials are never returned.
    """
    store = await _get_store(db)
    conn = await store.get_connection(connection_id)

    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
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


@router.post("/{connection_id}/test", response_model=TestConnectionResponse)
async def test_connection(
    connection_id: UUID,
    _user: SessionInfo = RequireAdmin,
    db: AsyncSession = Depends(get_db),
) -> TestConnectionResponse:
    """Test a connection by attempting to connect.

    Requires admin role. Decrypts credentials and attempts a connection.
    """
    store = await _get_store(db)
    resolved = await store.resolve_connection(connection_id)

    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection {connection_id} not found",
        )

    return _test_connection_params(
        db_type=resolved.type,
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
