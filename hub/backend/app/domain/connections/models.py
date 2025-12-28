"""Connection data models for Hub credential management.

These models define the data structures for database connections
stored and managed by Hub.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class DatabaseType(str, Enum):
    """Supported database types."""

    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    MSSQL = "mssql"


class ConnectionInfo(BaseModel):
    """Connection metadata without credentials (safe to send to clients).

    This is what the API returns - credentials are never exposed.
    """

    id: str
    name: str
    type: DatabaseType
    host: str
    port: int
    database: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResolvedConnection(BaseModel):
    """Connection with decrypted credentials (for internal use during execution).

    This should NEVER be sent to users - only returned to authenticated servers
    via the internal validation endpoint.
    """

    id: str
    name: str
    type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: str


class CreateConnectionInput(BaseModel):
    """Input for creating a new Hub connection."""

    name: str = Field(min_length=1, max_length=100)
    type: DatabaseType
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=0, max_length=1000)  # Password can be empty for some DBs


class UpdateConnectionInput(BaseModel):
    """Input for updating an existing connection (all fields optional)."""

    name: str | None = Field(None, min_length=1, max_length=100)
    host: str | None = Field(None, min_length=1, max_length=255)
    port: int | None = Field(None, ge=1, le=65535)
    database: str | None = Field(None, min_length=1, max_length=255)
    username: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=0, max_length=1000)
