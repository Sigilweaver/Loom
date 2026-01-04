"""Add file paths and grant group assignment.

Revision ID: 002
Revises: 001
Create Date: 2026-01-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === File Paths ===
    op.create_table(
        "file_paths",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("path", sa.String(1024), nullable=False),
        sa.Column("path_type", sa.String(20), nullable=False, server_default="local"),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("read_only", sa.Boolean, server_default=sa.false()),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # === Grant Group -> File Path (join table) ===
    op.create_table(
        "grant_group_file_paths",
        sa.Column(
            "grant_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("grant_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "file_path_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("file_paths.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", sa.String(255), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("grant_group_file_paths")
    op.drop_table("file_paths")
