"""API models for connection management endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.connections.models import DatabaseType


class ConnectionInfoResponse(BaseModel):
    """Connection info returned by API (no credentials)."""
    id: str
    name: str
    type: DatabaseType
    owner: Literal["server"] = "server"
    host: str
    port: int
    database: str
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class CreateConnectionRequest(BaseModel):
    """Request body for creating a connection."""
    name: str = Field(min_length=1, max_length=100, description="Display name for the connection")
    type: DatabaseType = Field(description="Database type")
    host: str = Field(min_length=1, max_length=255, description="Database host")
    port: int = Field(ge=1, le=65535, description="Database port")
    database: str = Field(min_length=1, max_length=255, description="Database name")
    username: str = Field(min_length=1, max_length=255, description="Database username")
    password: str = Field(min_length=0, max_length=1000, description="Database password")


class UpdateConnectionRequest(BaseModel):
    """Request body for updating a connection (all fields optional)."""
    name: str | None = Field(None, min_length=1, max_length=100)
    host: str | None = Field(None, min_length=1, max_length=255)
    port: int | None = Field(None, ge=1, le=65535)
    database: str | None = Field(None, min_length=1, max_length=255)
    username: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=0, max_length=1000)


class ConnectionTestResult(BaseModel):
    """Result of testing a connection."""
    success: bool
    message: str
    latency_ms: int | None = Field(None, serialization_alias="latencyMs")


class ConnectionStoreStatus(BaseModel):
    """Status of the connection store."""
    enabled: bool = Field(
        description="Whether server connections are enabled (encryption key configured)"
    )
    connection_count: int = Field(
        serialization_alias="connectionCount",
        description="Number of stored connections",
    )
