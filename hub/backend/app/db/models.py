"""SQLAlchemy models for Hub database"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


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
        DateTime, default=datetime.utcnow
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


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
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
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
    last_poll: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_healthy: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
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
        UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=True
    )

    # Status
    status: Mapped[str] = mapped_column(String(50), default="queued")
    queued_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Results
    success: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="executions")
    server: Mapped["Server"] = relationship("Server", back_populates="executions")


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

    # Where
    target_server_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id"), nullable=True
    )

    # Configuration
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=3600)

    # Metadata
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_trigger_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="schedules")
