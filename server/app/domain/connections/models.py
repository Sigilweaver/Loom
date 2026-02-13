"""Connection data models for server-side credential management."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConnectionOwner(str, Enum):
    """Who manages the connection credentials."""
    SERVER = "server"
    CLIENT = "client"


class DatabaseType(str, Enum):
    """Supported database types."""
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    MSSQL = "mssql"


class StoredConnection(BaseModel):
    """
    Full connection data as stored on disk (encrypted credentials).

    This is the internal storage format - credentials are encrypted at rest.
    """
    id: str
    name: str
    type: DatabaseType
    host: str
    port: int
    database: str
    # Credentials stored as Fernet-encrypted JSON string (base64)
    encrypted_credentials: str
    created_at: datetime
    updated_at: datetime


class ConnectionInfo(BaseModel):
    """
    Connection metadata without credentials (safe to send to clients).

    This is what the API returns - credentials are never exposed.
    """
    id: str
    name: str
    type: DatabaseType
    owner: Literal["server"] = "server"  # Server connections always have owner=server
    host: str
    port: int
    database: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class ResolvedConnection(BaseModel):
    """
    Connection with decrypted credentials (for internal use during execution).

    This should NEVER leave the server - used only for building connection URIs.
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
    """Input for creating a new server connection."""
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
