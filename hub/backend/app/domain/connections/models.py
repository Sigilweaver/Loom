"""Connection data models for Hub credential management.

These models define the data structures for connections (database, filesystem, etc.)
stored and managed by Hub.
"""

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

# =============================================================================
# Enums
# =============================================================================


class ConnectionType(str, Enum):
    """Supported connection types."""

    DATABASE = "database"
    FILESYSTEM = "filesystem"
    # S3 = "s3"  # Future


class DatabaseType(str, Enum):
    """Supported database types."""

    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    MSSQL = "mssql"


class PathType(str, Enum):
    """Supported filesystem path types."""

    LOCAL = "local"
    UNC = "unc"


# =============================================================================
# Type-Specific Configs (for responses - no secrets)
# =============================================================================


class DatabaseConfig(BaseModel):
    """Database-specific configuration (no credentials)."""

    db_type: DatabaseType
    host: str
    port: int
    database: str


class FilesystemConfig(BaseModel):
    """Filesystem-specific configuration."""

    path: str
    path_type: PathType


# =============================================================================
# Connection Info (API Response)
# =============================================================================


class ConnectionInfo(BaseModel):
    """Connection metadata without credentials (safe to send to clients).

    This is what the API returns - credentials are never exposed.
    Type-specific configuration is in database_config or filesystem_config.
    """

    id: str
    name: str
    type: ConnectionType
    description: str
    read_only: bool
    status: str
    last_checked: datetime | None
    last_healthy: datetime | None
    last_error: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    # Type-specific configs (only one populated based on type)
    database_config: DatabaseConfig | None = None
    filesystem_config: FilesystemConfig | None = None

    model_config = {"from_attributes": True}


# =============================================================================
# Resolved Connection (Internal - for Server execution)
# =============================================================================


class ResolvedDatabaseConnection(BaseModel):
    """Database connection with decrypted credentials (for Server execution).

    This should NEVER be sent to users - only returned to authenticated servers
    via the internal validation endpoint.
    """

    id: str
    name: str
    type: Literal["database"]
    read_only: bool
    db_type: DatabaseType
    host: str
    port: int
    database: str
    username: str
    password: str


class ResolvedFilesystemConnection(BaseModel):
    """Filesystem connection (for Server execution).

    Filesystem connections don't have credentials - just the path and access mode.
    """

    id: str
    name: str
    type: Literal["filesystem"]
    read_only: bool
    path: str
    path_type: PathType


ResolvedConnection = Union[ResolvedDatabaseConnection, ResolvedFilesystemConnection]


# =============================================================================
# Create Input (Discriminated Union)
# =============================================================================


class CreateDatabaseConnectionInput(BaseModel):
    """Input for creating a new database connection."""

    type: Literal["database"]
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    read_only: bool = Field(default=False)
    db_type: DatabaseType
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=0, max_length=1000)


class CreateFilesystemConnectionInput(BaseModel):
    """Input for creating a new filesystem connection."""

    type: Literal["filesystem"]
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    read_only: bool = Field(default=False)
    path: str = Field(min_length=1, max_length=1024)
    path_type: PathType = Field(default=PathType.LOCAL)


CreateConnectionInput = Annotated[
    Union[CreateDatabaseConnectionInput, CreateFilesystemConnectionInput],
    Field(discriminator="type"),
]


# =============================================================================
# Update Input (Discriminated Union)
# =============================================================================


class UpdateDatabaseConnectionInput(BaseModel):
    """Input for updating an existing database connection (all fields optional)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["database"] | None = None  # Can't change type
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=1000)
    read_only: bool | None = None
    host: str | None = Field(None, min_length=1, max_length=255)
    port: int | None = Field(None, ge=1, le=65535)
    database: str | None = Field(None, min_length=1, max_length=255)
    username: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=0, max_length=1000)


class UpdateFilesystemConnectionInput(BaseModel):
    """Input for updating an existing filesystem connection (all fields optional)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["filesystem"] | None = None  # Can't change type
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=1000)
    read_only: bool | None = None
    path: str | None = Field(None, min_length=1, max_length=1024)
    path_type: PathType | None = None


UpdateConnectionInput = Union[UpdateDatabaseConnectionInput, UpdateFilesystemConnectionInput]
