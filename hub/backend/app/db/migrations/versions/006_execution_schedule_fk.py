"""Add ON DELETE SET NULL to execution.schedule_id foreign key.

Revision ID: 006_execution_schedule_fk
Revises: 005_schedule_updates
Create Date: 2025-01-01
"""

from alembic import op


revision = "006_execution_schedule_fk"
down_revision = "005_schedule_updates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing foreign key constraint
    op.drop_constraint(
        "executions_schedule_id_fkey",
        "executions",
        type_="foreignkey",
    )

    # Re-create with ON DELETE SET NULL
    op.create_foreign_key(
        "executions_schedule_id_fkey",
        "executions",
        "schedules",
        ["schedule_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Drop the new foreign key constraint
    op.drop_constraint(
        "executions_schedule_id_fkey",
        "executions",
        type_="foreignkey",
    )

    # Re-create without ON DELETE SET NULL
    op.create_foreign_key(
        "executions_schedule_id_fkey",
        "executions",
        "schedules",
        ["schedule_id"],
        ["id"],
    )
