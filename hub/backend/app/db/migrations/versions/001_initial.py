"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2024-12-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), server_default="user"),
        sa.Column("api_key", sa.String(255), unique=True, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime, nullable=True),
    )

    # Workflows table
    op.create_table(
        "workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("author", sa.String(255), server_default=""),
        sa.Column("workflow_id", sa.String(255), nullable=False),
        sa.Column("folder_path", sa.String(1024), server_default="/"),
        sa.Column("tags", sa.Text, server_default=""),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("uploaded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Servers table
    op.create_table(
        "servers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("endpoint_url", sa.String(1024), nullable=False),
        sa.Column("auth_token", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), server_default="unknown"),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("last_poll", sa.DateTime, nullable=True),
        sa.Column("last_healthy", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(255), nullable=False),
    )

    # Schedules table (created before executions due to FK)
    op.create_table(
        "schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workflows.id"),
            nullable=False,
        ),
        sa.Column("cron_expression", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(100), server_default="UTC"),
        sa.Column(
            "target_server_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("servers.id"),
            nullable=True,
        ),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("timeout_seconds", sa.Integer, server_default="3600"),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("last_triggered_at", sa.DateTime, nullable=True),
        sa.Column("next_trigger_at", sa.DateTime, nullable=True),
    )

    # Executions table
    op.create_table(
        "executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workflows.id"),
            nullable=False,
        ),
        sa.Column(
            "server_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("servers.id"),
            nullable=False,
        ),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("triggered_by", sa.String(255), nullable=True),
        sa.Column(
            "schedule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schedules.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("queued_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("success", sa.Boolean, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
    )

    # Create indexes for common queries
    op.create_index("ix_workflows_folder_path", "workflows", ["folder_path"])
    op.create_index("ix_executions_workflow_id", "executions", ["workflow_id"])
    op.create_index("ix_executions_server_id", "executions", ["server_id"])
    op.create_index("ix_executions_status", "executions", ["status"])
    op.create_index("ix_schedules_workflow_id", "schedules", ["workflow_id"])
    op.create_index("ix_schedules_enabled", "schedules", ["enabled"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_schedules_enabled")
    op.drop_index("ix_schedules_workflow_id")
    op.drop_index("ix_executions_status")
    op.drop_index("ix_executions_server_id")
    op.drop_index("ix_executions_workflow_id")
    op.drop_index("ix_workflows_folder_path")

    # Drop tables in reverse order (respecting FKs)
    op.drop_table("executions")
    op.drop_table("schedules")
    op.drop_table("servers")
    op.drop_table("workflows")
    op.drop_table("users")
