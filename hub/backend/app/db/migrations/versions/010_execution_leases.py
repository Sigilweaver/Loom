"""Execution leases and scheduled-occurrence idempotency.

Adds the columns the durable dispatcher uses to claim queued executions
(claim_token, claimed_by, attempts), records the cron occurrence a scheduled
execution was created for (scheduled_for, unique per schedule), and adds a
partial index over queued/running rows for the claim and sweep queries.

Existing queued rows have no claim and are dispatched by the first Hub that
starts on this revision. Stop every Hub process before upgrading: an older
process does not take part in claims.

Revision ID: 010
Revises: 009
Create Date: 2026-11-05
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("executions", sa.Column("claim_token", UUID(as_uuid=True), nullable=True))
    op.add_column("executions", sa.Column("claimed_by", sa.String(255), nullable=True))
    op.add_column(
        "executions",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "executions",
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "uq_executions_schedule_occurrence",
        "executions",
        ["schedule_id", "scheduled_for"],
        unique=True,
        postgresql_where=sa.text("scheduled_for IS NOT NULL"),
    )
    op.create_index(
        "ix_executions_active",
        "executions",
        ["status", "queued_at"],
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_index("ix_executions_active", table_name="executions")
    op.drop_index("uq_executions_schedule_occurrence", table_name="executions")
    op.drop_column("executions", "scheduled_for")
    op.drop_column("executions", "attempts")
    op.drop_column("executions", "claimed_by")
    op.drop_column("executions", "claim_token")
