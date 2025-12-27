"""Server registry routes"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/servers")


class ServerStatus(BaseModel):
    """Server status from polling"""
    status: str  # online, offline, error
    version: str | None
    last_poll: str
    last_healthy: str | None


class ServerCreate(BaseModel):
    """Request to register a new server"""
    name: str
    endpoint_url: str
    auth_token: str | None = None


class ServerUpdate(BaseModel):
    """Request to update server config"""
    name: str | None = None
    endpoint_url: str | None = None
    auth_token: str | None = None


class ServerResponse(BaseModel):
    """Server details"""
    id: UUID
    name: str
    endpoint_url: str
    status: str
    version: str | None
    last_poll: str | None
    last_healthy: str | None
    created_at: str


class ServerListResponse(BaseModel):
    """List of servers"""
    servers: list[ServerResponse]
    total: int


class ConnectionInfo(BaseModel):
    """Connection info from a server (read-only view)"""
    name: str
    type: str


class ServerConnectionsResponse(BaseModel):
    """Connections available on a server"""
    server_id: UUID
    connections: list[ConnectionInfo]


@router.get("", response_model=ServerListResponse)
async def list_servers() -> ServerListResponse:
    """List all registered servers"""
    # TODO: Implement with database
    return ServerListResponse(
        servers=[],
        total=0,
    )


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def register_server(request: ServerCreate) -> ServerResponse:
    """Register a new server"""
    # TODO: Implement with database
    # Immediately poll the server to check connectivity
    from datetime import datetime
    from uuid import uuid4

    return ServerResponse(
        id=uuid4(),
        name=request.name,
        endpoint_url=request.endpoint_url,
        status="unknown",
        version=None,
        last_poll=None,
        last_healthy=None,
        created_at=datetime.utcnow().isoformat(),
    )


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(server_id: UUID) -> ServerResponse:
    """Get server details"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Server not found",
    )


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(server_id: UUID, request: ServerUpdate) -> ServerResponse:
    """Update server configuration"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Server not found",
    )


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_server(server_id: UUID) -> None:
    """Remove a server from the registry"""
    # TODO: Implement with database
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Server not found",
    )


@router.get("/{server_id}/connections", response_model=ServerConnectionsResponse)
async def get_server_connections(server_id: UUID) -> ServerConnectionsResponse:
    """Get connections available on a server (proxied from server's API)"""
    # TODO: Implement - proxy to server's /api/connections endpoint
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Server not found",
    )
