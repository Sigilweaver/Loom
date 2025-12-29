"""Add description and updated_at to schedules, make created_by nullable.

Revision ID: 005_schedule_updates
Revises: 004_groups
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa


revision = "005_schedule_updates"
down_revision = "004_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add description column
    op.add_column(
        "schedules",
        sa.Column("description", sa.Text, nullable=True),
    )

    # Add updated_at column
    op.add_column(
        "schedules",
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    # Make created_by nullable (for API-created schedules)
    op.alter_column(
        "schedules",
        "created_by",
        existing_type=sa.String(255),
        nullable=True,
    )

    # Drop timeout_seconds column (not used in current implementation)
    op.drop_column("schedules", "timeout_seconds")


def downgrade() -> None:
    # Add back timeout_seconds
    op.add_column(
        "schedules",
        sa.Column("timeout_seconds", sa.Integer, server_default="3600"),
    )

    # Make created_by not nullable again
    op.alter_column(
        "schedules",
        "created_by",
        existing_type=sa.String(255),
        nullable=False,
    )

    # Drop updated_at column
    op.drop_column("schedules", "updated_at")

    # Drop description column
    op.drop_column("schedules", "description")
