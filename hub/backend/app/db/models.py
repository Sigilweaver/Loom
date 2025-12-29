"""SQLAlchemy models for Hub database"""

import uuid
from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
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
    api_key: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    last_poll: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_healthy: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    executions: Mapped[list["Execution"]] = relationship(
        "Execution", back_populates="server"
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
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    """Hub-managed database connection credentials.

    Credentials are stored encrypted using Fernet symmetric encryption.
    The encryption key must be provided via environment variable.
    """

    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # postgresql, mysql, etc.
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(255), nullable=False)

    # Credentials stored as Fernet-encrypted JSON string (base64)
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False)

    # Metadata
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    groups: Mapped[list["ConnectionGroup"]] = relationship(
        "ConnectionGroup", back_populates="connection", cascade="all, delete-orphan"
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
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")


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
    connections: Mapped[list["ConnectionGroup"]] = relationship(
        "ConnectionGroup", back_populates="group", cascade="all, delete-orphan"
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


class ConnectionGroup(Base):
    """Join table for Connection <-> Group assignment."""

    __tablename__ = "connection_groups"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # When the connection was assigned to the group
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    # Relationships
    connection: Mapped["Connection"] = relationship("Connection", back_populates="groups")
    group: Mapped["Group"] = relationship("Group", back_populates="connections")
