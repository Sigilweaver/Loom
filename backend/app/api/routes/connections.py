"""API routes for server connection management.

Provides CRUD operations for server-managed database connections.
Credentials are encrypted at rest and never exposed in API responses.
"""

import time

from fastapi import APIRouter, HTTPException

from app.api.models.connections import (
    ConnectionInfoResponse,
    ConnectionStoreStatus,
    ConnectionTestResult,
    CreateConnectionRequest,
    UpdateConnectionRequest,
)
from app.domain.connections.models import CreateConnectionInput, UpdateConnectionInput
from app.domain.connections.store import (
    ConnectionNotFoundError,
    ConnectionStoreError,
    DuplicateConnectionError,
    EncryptionKeyError,
    get_connection_store,
)

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/status", response_model=ConnectionStoreStatus)
async def get_status() -> ConnectionStoreStatus:
    """
    Get connection store status.

    Returns whether server connections are enabled (encryption key configured)
    and the current connection count.
    """
    store = get_connection_store()
    return ConnectionStoreStatus(
        enabled=store.is_enabled,
        connectionCount=len(store.list_connections()),
    )


@router.get("/", response_model=list[ConnectionInfoResponse])
async def list_connections() -> list[ConnectionInfoResponse]:
    """
    List all server-managed connections.

    Returns connection metadata without credentials.
    All returned connections have owner="server".
    """
    store = get_connection_store()
    connections = store.list_connections()
    return [
        ConnectionInfoResponse(
            id=c.id,
            name=c.name,
            type=c.type,
            owner="server",
            host=c.host,
            port=c.port,
            database=c.database,
            createdAt=c.created_at,
            updatedAt=c.updated_at,
        )
        for c in connections
    ]


@router.get("/{connection_id}", response_model=ConnectionInfoResponse)
async def get_connection(connection_id: str) -> ConnectionInfoResponse:
    """
    Get a specific connection by ID.

    Returns connection metadata without credentials.
    """
    store = get_connection_store()
    conn = store.get_connection(connection_id)

    if not conn:
        raise HTTPException(status_code=404, detail=f"Connection {connection_id} not found")

    return ConnectionInfoResponse(
        id=conn.id,
        name=conn.name,
        type=conn.type,
        owner="server",
        host=conn.host,
        port=conn.port,
        database=conn.database,
        createdAt=conn.created_at,
        updatedAt=conn.updated_at,
    )


@router.post("/", response_model=ConnectionInfoResponse, status_code=201)
async def create_connection(request: CreateConnectionRequest) -> ConnectionInfoResponse:
    """
    Create a new server-managed connection.

    Credentials are encrypted at rest using Fernet encryption.
    Requires CONNECTION_ENCRYPTION_KEY to be configured.
    """
    store = get_connection_store()

    if not store.is_enabled:
        raise HTTPException(
            status_code=503,
            detail="Server connections not enabled. "
            "Set CONNECTION_ENCRYPTION_KEY environment variable.",
        )

    try:
        input_data = CreateConnectionInput(
            name=request.name,
            type=request.type,
            host=request.host,
            port=request.port,
            database=request.database,
            username=request.username,
            password=request.password,
        )
        conn = store.create_connection(input_data)

        return ConnectionInfoResponse(
            id=conn.id,
            name=conn.name,
            type=conn.type,
            owner="server",
            host=conn.host,
            port=conn.port,
            database=conn.database,
            createdAt=conn.created_at,
            updatedAt=conn.updated_at,
        )
    except DuplicateConnectionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except EncryptionKeyError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ConnectionStoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{connection_id}", response_model=ConnectionInfoResponse)
async def update_connection(
    connection_id: str, request: UpdateConnectionRequest
) -> ConnectionInfoResponse:
    """
    Update an existing connection.

    All fields are optional - only provided fields will be updated.
    Credentials remain encrypted.
    """
    store = get_connection_store()

    if not store.is_enabled:
        raise HTTPException(
            status_code=503,
            detail="Server connections not enabled. "
            "Set CONNECTION_ENCRYPTION_KEY environment variable.",
        )

    try:
        input_data = UpdateConnectionInput(
            name=request.name,
            host=request.host,
            port=request.port,
            database=request.database,
            username=request.username,
            password=request.password,
        )
        conn = store.update_connection(connection_id, input_data)

        return ConnectionInfoResponse(
            id=conn.id,
            name=conn.name,
            type=conn.type,
            owner="server",
            host=conn.host,
            port=conn.port,
            database=conn.database,
            createdAt=conn.created_at,
            updatedAt=conn.updated_at,
        )
    except ConnectionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DuplicateConnectionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except EncryptionKeyError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ConnectionStoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(connection_id: str) -> None:
    """
    Delete a connection.

    Removes the connection and its encrypted credentials from storage.
    """
    store = get_connection_store()

    try:
        store.delete_connection(connection_id)
    except ConnectionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConnectionStoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(connection_id: str) -> ConnectionTestResult:
    """
    Test a connection by attempting to connect to the database.

    This decrypts credentials server-side and attempts a connection.
    Useful for validating connection configuration.
    """
    store = get_connection_store()

    if not store.is_enabled:
        raise HTTPException(
            status_code=503,
            detail="Server connections not enabled. "
            "Set CONNECTION_ENCRYPTION_KEY environment variable.",
        )

    resolved = store.resolve_connection(connection_id)
    if not resolved:
        raise HTTPException(status_code=404, detail=f"Connection {connection_id} not found")

    # Build URI and attempt connection
    uri = store.build_connection_uri(connection_id)
    if not uri:
        return ConnectionTestResult(success=False, message="Failed to build connection URI")

    try:
        import polars as pl

        start_time = time.time()

        # Use a simple query to test the connection
        # Different databases have different syntax
        if resolved.type.value == "postgresql":
            test_query = "SELECT 1"
        elif resolved.type.value == "mysql":
            test_query = "SELECT 1"
        elif resolved.type.value == "sqlite":
            test_query = "SELECT 1"
        else:
            test_query = "SELECT 1"

        # Attempt the query
        pl.read_database_uri(
            query=test_query,
            uri=uri,
            engine="connectorx",
        )

        latency_ms = int((time.time() - start_time) * 1000)

        return ConnectionTestResult(
            success=True,
            message=f"Successfully connected to {resolved.name}",
            latencyMs=latency_ms,
        )
    except Exception as e:
        error_msg = str(e)

        # Sanitize error message to not leak credentials
        if resolved.password and resolved.password in error_msg:
            error_msg = error_msg.replace(resolved.password, "***")
        if resolved.username and resolved.username in error_msg:
            error_msg = error_msg.replace(resolved.username, "***")

        return ConnectionTestResult(
            success=False,
            message=f"Connection failed: {error_msg}",
        )
