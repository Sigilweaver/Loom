"""Execution heartbeat.

Adds executions.heartbeat_at, refreshed by the runner while it waits on the
Server, so executions orphaned by a Hub restart can be detected and failed.

Revision ID: 009
Revises: 008
Create Date: 2026-02-03
"""

import sqlalchemy as sa
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "executions",
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("executions", "heartbeat_at")
