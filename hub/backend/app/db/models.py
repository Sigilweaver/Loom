"""SQLAlchemy models for Hub database"""

import uuid
from datetime import UTC, datetime
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """Base class for all models"""

    pass


class User(Base):
    """User account"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user")
    api_key: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    groups: Mapped[list["UserGroup"]] = relationship(
        "UserGroup", back_populates="user", cascade="all, delete-orphan"
    )


class Workflow(Base):
    """Stored workflow file"""

    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Extracted from .swwf metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String(255), default="")
    workflow_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Hub-managed
    folder_path: Mapped[str] = mapped_column(String(1024), default="/")
    tags: Mapped[str] = mapped_column(Text, default="")

    # Content
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)

    # Metadata
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )

    # Relationships
    executions: Mapped[list["Execution"]] = relationship(
        "Execution", back_populates="workflow"
    )
    schedules: Mapped[list["Schedule"]] = relationship(
        "Schedule", back_populates="workflow"
    )


class WorkflowRevision(Base):
    """Append-only revision history for a workflow.

    Every content-changing save (upload, replace, or rollback) records a new
    immutable revision: the full file blob, its checksum, the author, an
    optional message, and a pointer to the revision it descends from. This
    gives a non-git, linear history that supports diffing and rollback.
    """

    __tablename__ = "workflow_revisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 1-based, monotonic per workflow; orders the history and labels revisions.
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # The revision this one was created from (None for the first revision).
    parent_revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )

    author: Mapped[str] = mapped_column(String(255), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    blob: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    message: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "workflow_id",
            "revision_number",
            name="uq_workflow_revision_number",
        ),
    )


class Server(Base):
    """Registered server instance"""

    __tablename__ = "servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    endpoint_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    auth_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(50), default="unknown")
    version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_poll: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_healthy: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    executions: Mapped[list["Execution"]] = relationship(
        "Execution", back_populates="server"
    )
    groups: Mapped[list["ServerGroup"]] = relationship(
        "ServerGroup", back_populates="server", cascade="all, delete-orphan"
    )


class Execution(Base):
    """Workflow execution record"""

    __tablename__ = "executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # What
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False
    )

    # Where
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False
    )

    # Trigger
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    triggered_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    schedule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Status
    status: Mapped[str] = mapped_column(String(50), default="queued")
    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Refreshed by the runner while it waits on the Server; used to detect
    # runs orphaned by a Hub restart.
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Results
    success: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="executions")
    server: Mapped["Server"] = relationship("Server", back_populates="executions")
    schedule: Mapped[Optional["Schedule"]] = relationship(
        "Schedule", back_populates="executions"
    )


class Schedule(Base):
    """Workflow schedule"""

    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False
    )

    # When
    cron_expression: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    start_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # Don't trigger before this time

    # Where
    target_server_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id"), nullable=True
    )

    # Configuration
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    created_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_utcnow
    )
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_trigger_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="schedules")
    target_server: Mapped[Optional["Server"]] = relationship("Server")
    executions: Mapped[list["Execution"]] = relationship(
        "Execution", back_populates="schedule", passive_deletes=True
    )


class Connection(Base):
    """Hub-managed connection for data access.

    Connections are a unified abstraction for data sources:
    - Database connections (PostgreSQL, MySQL, etc.)
    - Filesystem paths (local, UNC)
    - S3 buckets (future)

    Type-specific configuration is stored in separate tables
    (ConnectionDatabase, ConnectionFilesystem) linked via connection_id.
    """

    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # database, filesystem, s3
    description: Mapped[str] = mapped_column(Text, default="")
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)

    # Health status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    last_checked: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_healthy: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships to type-specific tables
    database_config: Mapped[Optional["ConnectionDatabase"]] = relationship(
        "ConnectionDatabase",
        back_populates="connection",
        uselist=False,
        cascade="all, delete-orphan",
    )
    filesystem_config: Mapped[Optional["ConnectionFilesystem"]] = relationship(
        "ConnectionFilesystem",
        back_populates="connection",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # Hot-path index for connection-list filters/sorts.
    __table_args__ = (Index("idx_connections_status", "status"),)


class ConnectionDatabase(Base):
    """Database-specific connection configuration.

    Credentials are stored encrypted using Fernet symmetric encryption.
    The encryption key must be provided via environment variable.
    """

    __tablename__ = "connection_databases"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    db_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # postgresql, mysql, sqlite, mssql
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(255), nullable=False)

    # Credentials stored as Fernet-encrypted JSON string (base64)
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship back to base
    connection: Mapped["Connection"] = relationship(
        "Connection", back_populates="database_config"
    )


class ConnectionFilesystem(Base):
    """Filesystem-specific connection configuration.

    File paths are directory roots that users can browse on Server instances.
    """

    __tablename__ = "connection_filesystems"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    path_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="local"
    )  # local, unc

    # Relationship back to base
    connection: Mapped["Connection"] = relationship(
        "Connection", back_populates="filesystem_config"
    )


class Session(Base):
    """User session for authentication

    Sessions are stored in the database to allow server-side invalidation
    and session management (logout, view active sessions, etc.).
    """

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Link to user
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Session token (hashed for security - we store hash, client gets plaintext)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Client info for session management UI
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")


class ServerToken(Base):
    """One-time-use opaque token authorizing a server to act for a user.

    Persisted to support multi-replica Hub deployments where in-memory tokens
    cannot be shared. Atomic claim is performed via
    ``UPDATE ... SET used_at = NOW() WHERE token = :t AND used_at IS NULL
    AND expires_at > NOW() RETURNING ...`` so concurrent consumers race to
    claim and only one succeeds.
    """

    __tablename__ = "server_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    server_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Group(Base):
    """Organizational group for access control.

    Groups are created by admins to organize users and scope resource access.
    Users belong to groups, and connections can be assigned to groups.
    A user can only access connections that belong to groups they're a member of.
    """

    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    # Metadata
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    members: Mapped[list["UserGroup"]] = relationship(
        "UserGroup", back_populates="group", cascade="all, delete-orphan"
    )
    servers: Mapped[list["ServerGroup"]] = relationship(
        "ServerGroup", back_populates="group", cascade="all, delete-orphan"
    )
    grant_groups: Mapped[list["UserGroupGrantGroup"]] = relationship(
        "UserGroupGrantGroup", back_populates="user_group", cascade="all, delete-orphan"
    )


class UserGroup(Base):
    """Join table for User <-> Group membership."""

    __tablename__ = "user_groups"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # When the user was added to the group
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="groups")
    group: Mapped["Group"] = relationship("Group", back_populates="members")

    # Explicit indexes for reverse-direction lookups. The composite
    # primary key (user_id, group_id) already covers user_id-leading
    # scans; per-column indexes serve "find all users in group" and
    # "find all groups for user" workloads independently.
    __table_args__ = (
        Index("idx_user_groups_user", "user_id"),
        Index("idx_user_groups_group", "group_id"),
    )


# NOTE: ConnectionGroup model removed in API v1
# Connection access is now managed exclusively through grant groups:
# User -> UserGroup -> GrantGroup -> Connection


class ServerGroup(Base):
    """Join table for Server <-> Group assignment.

    Servers assigned to groups become available to users in those groups
    for schedule targeting and execution.
    """

    __tablename__ = "server_groups"

    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("servers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # When the server was assigned to the group
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    # Who assigned it
    assigned_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    server: Mapped["Server"] = relationship("Server", back_populates="groups")
    group: Mapped["Group"] = relationship("Group", back_populates="servers")


class AuditEvent(Base):
    """Immutable audit log entry.

    Append-only by convention: the application never updates or deletes rows,
    but the database does not enforce this (there is no trigger). Tampering is
    detected, not prevented, via the hash chain (see ``AuditService.verify_chain``).
    ``hash_version`` 1 rows predate a reproducible hash and cannot be verified.
    """

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    # What happened
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Context
    execution_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    workflow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    schedule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Who ("user" | "schedule" | "system")
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Snapshot of username/schedule name
    actor_identity: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Where
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    server_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Event-specific data (small - IDs and outcomes only)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Integrity
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 1 = legacy (unverifiable content hash), 2 = reproducible from stored columns.
    hash_version: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    # Timeline queries fetch newest-first.
    __table_args__ = (Index("idx_audit_events_timestamp", "timestamp"),)


class ExecutionRecord(Base):
    """Complete execution record with rich details.

    Single row per execution with JSONB for detailed data.
    Columns for searchable/filterable fields.
    """

    __tablename__ = "execution_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id"), unique=True, index=True
    )

    # === Searchable columns ===

    # Status ("completed" | "failed" | "cancelled")
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Timing
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Output summary
    output_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_columns: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Error summary (for filtering)
    error_type: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Connections used (for filtering: "show me all executions using connection X")
    connection_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)

    # === Rich JSONB details ===
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Relationships
    execution: Mapped["Execution"] = relationship("Execution")


class ExecutionArtifact(Base):
    """Pointer to a content-addressed execution output blob.

    The blob bytes live in the artifact store (keyed by ``sha256``); this row
    records the pointer, the integrity checksum, and lightweight metadata so
    outputs can be listed and streamed back, and verified on retrieval.
    """

    __tablename__ = "execution_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("executions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Human-facing file name, e.g. "output-<socket>.csv".
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="application/octet-stream"
    )

    # Content address + integrity checksum (hex SHA-256, 64 chars).
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Optional output-shape metadata.
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    # Relationships
    execution: Mapped["Execution"] = relationship("Execution")


# =============================================================================
# Grant Groups - Permission Bundles
# =============================================================================


class GrantGroup(Base):
    """Permission bundle containing grants (connections, collections, etc.).

    Grant Groups separate permission management from user membership.
    User Groups contain users and reference Grant Groups.
    Grant Groups contain grants only (connections, collections, etc.).

    This enables:
    - Reusable permission bundles across teams
    - Single audit path: User -> User Group -> Grant Group -> Grant
    - No cycles possible (Grant Groups cannot reference other groups)
    """

    __tablename__ = "grant_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    # Metadata
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    connections: Mapped[list["GrantGroupConnection"]] = relationship(
        "GrantGroupConnection",
        back_populates="grant_group",
        cascade="all, delete-orphan",
    )
    user_groups: Mapped[list["UserGroupGrantGroup"]] = relationship(
        "UserGroupGrantGroup",
        back_populates="grant_group",
        cascade="all, delete-orphan",
    )


class UserGroupGrantGroup(Base):
    """Join table: User Group -> Grant Group assignment.

    Links user groups (which contain users) to grant groups (which contain permissions).
    """

    __tablename__ = "user_group_grant_groups"

    user_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    grant_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grant_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    assigned_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    user_group: Mapped["Group"] = relationship("Group", back_populates="grant_groups")
    grant_group: Mapped["GrantGroup"] = relationship(
        "GrantGroup", back_populates="user_groups"
    )

    # Indexes on the permission-join hot path. The composite PK
    # (user_group_id, grant_group_id) already covers the leading-column
    # lookup; the reverse-direction index supports "given a grant group,
    # find all user groups referencing it".
    __table_args__ = (
        Index("idx_uggg_lookup", "user_group_id", "grant_group_id"),
        Index("idx_uggg_grant_group", "grant_group_id"),
    )


class GrantGroupConnection(Base):
    """Join table: Grant Group -> Connection assignment.

    Connections assigned to a grant group become accessible to users
    who are members of user groups that reference this grant group.
    """

    __tablename__ = "grant_group_connections"

    grant_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grant_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    assigned_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    grant_group: Mapped["GrantGroup"] = relationship(
        "GrantGroup", back_populates="connections"
    )
    connection: Mapped["Connection"] = relationship("Connection")

    # Indexes for forward and reverse permission-join lookups.
    __table_args__ = (
        Index("idx_gg_conn_lookup", "grant_group_id", "connection_id"),
        Index("idx_gg_conn_reverse", "connection_id"),
    )
