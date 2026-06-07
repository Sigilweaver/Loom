"""Persistent server-token store for multi-replica Hub.

Revision ID: 004
Revises: 003
Create Date: 2026-01-04
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "server_tokens",
        sa.Column("token", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("server_id", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_server_tokens_user_id", "server_tokens", ["user_id"]
    )
    op.create_index(
        "ix_server_tokens_server_id", "server_tokens", ["server_id"]
    )
    op.create_index(
        "ix_server_tokens_expires_at", "server_tokens", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_server_tokens_expires_at", table_name="server_tokens")
    op.drop_index("ix_server_tokens_server_id", table_name="server_tokens")
    op.drop_index("ix_server_tokens_user_id", table_name="server_tokens")
    op.drop_table("server_tokens")
