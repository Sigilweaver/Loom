"""Append-only workflow revision history.

Revision ID: 007
Revises: 006
Create Date: 2026-02-01
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column(
            "parent_revision_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workflow_revisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("blob", sa.LargeBinary(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "workflow_id",
            "revision_number",
            name="uq_workflow_revision_number",
        ),
    )
    op.create_index(
        "ix_workflow_revisions_workflow_id",
        "workflow_revisions",
        ["workflow_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_revisions_workflow_id", table_name="workflow_revisions")
    op.drop_table("workflow_revisions")
