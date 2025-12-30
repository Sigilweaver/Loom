"""Add audit_events and execution_records tables

Revision ID: 009_audit_execution_records
Revises: 008_connection_health
Create Date: 2025-12-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "009_audit_execution_records"
down_revision: Union[str, None] = "008_connection_health"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create audit_events table
    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("execution_id", sa.UUID(), nullable=True),
        sa.Column("workflow_id", sa.UUID(), nullable=True),
        sa.Column("schedule_id", sa.UUID(), nullable=True),
        sa.Column("actor_type", sa.String(length=50), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_identity", sa.String(length=255), nullable=False),
        sa.Column("auth_method", sa.String(length=50), nullable=True),
        sa.Column("client_ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("server_id", sa.UUID(), nullable=True),
        sa.Column(
            "details", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for audit_events
    op.create_index("idx_audit_events_execution_id", "audit_events", ["execution_id"])
    op.create_index("idx_audit_events_workflow_id", "audit_events", ["workflow_id"])
    op.create_index("idx_audit_events_actor_id", "audit_events", ["actor_id"])
    op.create_index("idx_audit_events_timestamp", "audit_events", ["timestamp"])
    op.create_index("idx_audit_events_event_type", "audit_events", ["event_type"])

    # Create immutability trigger function
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_event_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted';
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger to prevent UPDATE/DELETE on audit_events
    op.execute("""
        CREATE TRIGGER audit_events_immutable
            BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW
            EXECUTE FUNCTION prevent_audit_event_modification();
    """)

    # Create execution_records table
    op.create_table(
        "execution_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("execution_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("output_rows", sa.Integer(), nullable=True),
        sa.Column("output_columns", sa.Integer(), nullable=True),
        sa.Column("output_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_type", sa.String(length=100), nullable=True),
        sa.Column(
            "connection_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        sa.Column(
            "details", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.ForeignKeyConstraint(["execution_id"], ["executions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("execution_id"),
    )

    # Create indexes for execution_records
    op.create_index("idx_execution_records_execution_id", "execution_records", ["execution_id"])
    op.create_index("idx_execution_records_status", "execution_records", ["status"])
    op.create_index("idx_execution_records_started_at", "execution_records", ["started_at"])
    op.create_index("idx_execution_records_error_type", "execution_records", ["error_type"])

    # GIN index for connection_ids array containment queries
    op.execute("""
        CREATE INDEX idx_execution_records_connection_ids 
        ON execution_records USING GIN(connection_ids);
    """)


def downgrade() -> None:
    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_event_modification()")

    # Drop execution_records indexes and table
    op.execute("DROP INDEX IF EXISTS idx_execution_records_connection_ids")
    op.drop_index("idx_execution_records_error_type", table_name="execution_records")
    op.drop_index("idx_execution_records_started_at", table_name="execution_records")
    op.drop_index("idx_execution_records_status", table_name="execution_records")
    op.drop_index("idx_execution_records_execution_id", table_name="execution_records")
    op.drop_table("execution_records")

    # Drop audit_events indexes and table
    op.drop_index("idx_audit_events_event_type", table_name="audit_events")
    op.drop_index("idx_audit_events_timestamp", table_name="audit_events")
    op.drop_index("idx_audit_events_actor_id", table_name="audit_events")
    op.drop_index("idx_audit_events_workflow_id", table_name="audit_events")
    op.drop_index("idx_audit_events_execution_id", table_name="audit_events")
    op.drop_table("audit_events")
