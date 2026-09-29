"""Initial schema with all tables.

Revision ID: 001
Create Date: 2026-01-02
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === Users ===
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), default="user"),
        sa.Column("api_key", sa.String(255), unique=True, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )

    # === Sessions ===
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(255), nullable=False, index=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # === Groups (User Groups) ===
    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === User Groups (join table) ===
    op.create_table(
        "user_groups",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === Workflows ===
    op.create_table(
        "workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("author", sa.String(255), default=""),
        sa.Column("workflow_id", sa.String(255), nullable=False),
        sa.Column("folder_path", sa.String(1024), default="/"),
        sa.Column("tags", sa.Text, default=""),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("uploaded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === Servers ===
    op.create_table(
        "servers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("endpoint_url", sa.String(1024), nullable=False),
        sa.Column("auth_token", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), default="unknown"),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("last_poll", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_healthy", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(255), nullable=False),
    )

    # === Server Groups (join table) ===
    op.create_table(
        "server_groups",
        sa.Column(
            "server_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("servers.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", sa.String(255), nullable=False),
    )

    # === Schedules ===
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
        sa.Column("timezone", sa.String(100), default="UTC"),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "target_server_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("servers.id"),
            nullable=True,
        ),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_trigger_at", sa.DateTime(timezone=True), nullable=True),
    )

    # === Executions ===
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
            sa.ForeignKey("schedules.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(50), default="queued"),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("success", sa.Boolean, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
    )

    # === Connections ===
    op.create_table(
        "connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer, nullable=False),
        sa.Column("database", sa.String(255), nullable=False),
        sa.Column("encrypted_credentials", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, default="unknown"),
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_healthy", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === Grant Groups ===
    op.create_table(
        "grant_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === User Group -> Grant Group (join table) ===
    op.create_table(
        "user_group_grant_groups",
        sa.Column(
            "user_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "grant_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("grant_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", sa.String(255), nullable=False),
    )

    # === Grant Group -> Connection (join table) ===
    op.create_table(
        "grant_group_connections",
        sa.Column(
            "grant_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("grant_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("connections.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", sa.String(255), nullable=False),
    )

    # === Audit Events ===
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("schedule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", sa.String(50), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("actor_identity", sa.String(255), nullable=False),
        sa.Column("auth_method", sa.String(50), nullable=True),
        sa.Column("client_ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("details", postgresql.JSONB, default=dict),
        sa.Column("event_hash", sa.String(64), nullable=False),
        sa.Column("previous_hash", sa.String(64), nullable=True),
    )

    # === Execution Records ===
    op.create_table(
        "execution_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "execution_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("executions.id"),
            unique=True,
            index=True,
        ),
        sa.Column("status", sa.String(50), nullable=False, index=True),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("output_rows", sa.Integer, nullable=True),
        sa.Column("output_columns", sa.Integer, nullable=True),
        sa.Column("output_bytes", sa.BigInteger, nullable=True),
        sa.Column("error_type", sa.String(100), nullable=True, index=True),
        sa.Column("connection_ids", postgresql.JSONB, default=list),
        sa.Column("details", postgresql.JSONB, default=dict),
    )


def downgrade() -> None:
    op.drop_table("execution_records")
    op.drop_table("audit_events")
    op.drop_table("grant_group_connections")
    op.drop_table("user_group_grant_groups")
    op.drop_table("grant_groups")
    op.drop_table("connections")
    op.drop_table("executions")
    op.drop_table("schedules")
    op.drop_table("server_groups")
    op.drop_table("servers")
    op.drop_table("workflows")
    op.drop_table("user_groups")
    op.drop_table("groups")
    op.drop_table("sessions")
    op.drop_table("users")
