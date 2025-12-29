"""Add start_at to schedules for delayed schedule start.

Revision ID: 007_schedule_start_at
Revises: 006_execution_schedule_fk
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa


revision = "007_schedule_start_at"
down_revision = "006_execution_schedule_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "schedules",
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("schedules", "start_at")
