"""Add health status fields to connections

Revision ID: 008_connection_health
Revises: 007_schedule_start_at
Create Date: 2025-12-29
"""

import sqlalchemy as sa
from alembic import op

revision = "008_connection_health"
down_revision = "007_schedule_start_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "connections",
        sa.Column("status", sa.String(20), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "connections",
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "connections",
        sa.Column("last_healthy", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "connections",
        sa.Column("last_error", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("connections", "last_error")
    op.drop_column("connections", "last_healthy")
    op.drop_column("connections", "last_checked")
    op.drop_column("connections", "status")
