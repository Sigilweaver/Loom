"""Execution artifact pointers (content-addressed output store).

Revision ID: 006
Revises: 005
Create Date: 2026-02-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "execution_artifacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "execution_id",
            UUID(as_uuid=True),
            sa.ForeignKey("executions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("media_type", sa.String(length=100), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_execution_artifacts_execution_id",
        "execution_artifacts",
        ["execution_id"],
    )
    op.create_index(
        "ix_execution_artifacts_sha256",
        "execution_artifacts",
        ["sha256"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_execution_artifacts_sha256", table_name="execution_artifacts"
    )
    op.drop_index(
        "ix_execution_artifacts_execution_id", table_name="execution_artifacts"
    )
    op.drop_table("execution_artifacts")
