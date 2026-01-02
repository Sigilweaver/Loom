"""add_grant_groups

Revision ID: 011_add_grant_groups
Revises: 010_add_server_groups
Create Date: 2026-01-02

Add grant groups for permission bundling. This separates user membership
from permission management:
- User Groups contain users and reference Grant Groups
- Grant Groups contain grants (connections, etc.)

This enables reusable permission bundles and a single audit path.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "011_add_grant_groups"
down_revision: Union[str, None] = "010_add_server_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add grant groups tables."""
    # Grant Groups table - permission bundles
    op.create_table(
        "grant_groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # User Group -> Grant Group join table
    op.create_table(
        "user_group_grant_groups",
        sa.Column("user_group_id", sa.UUID(), nullable=False),
        sa.Column("grant_group_id", sa.UUID(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("assigned_by", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["user_group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["grant_group_id"], ["grant_groups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_group_id", "grant_group_id"),
    )

    # Grant Group -> Connection join table
    op.create_table(
        "grant_group_connections",
        sa.Column("grant_group_id", sa.UUID(), nullable=False),
        sa.Column("connection_id", sa.UUID(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("assigned_by", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ["grant_group_id"], ["grant_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["connection_id"], ["connections.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("grant_group_id", "connection_id"),
    )

    # Add indexes for common queries
    op.create_index(
        "ix_user_group_grant_groups_user_group_id",
        "user_group_grant_groups",
        ["user_group_id"],
    )
    op.create_index(
        "ix_user_group_grant_groups_grant_group_id",
        "user_group_grant_groups",
        ["grant_group_id"],
    )
    op.create_index(
        "ix_grant_group_connections_grant_group_id",
        "grant_group_connections",
        ["grant_group_id"],
    )
    op.create_index(
        "ix_grant_group_connections_connection_id",
        "grant_group_connections",
        ["connection_id"],
    )


def downgrade() -> None:
    """Remove grant groups tables."""
    op.drop_index(
        "ix_grant_group_connections_connection_id", table_name="grant_group_connections"
    )
    op.drop_index(
        "ix_grant_group_connections_grant_group_id", table_name="grant_group_connections"
    )
    op.drop_index(
        "ix_user_group_grant_groups_grant_group_id", table_name="user_group_grant_groups"
    )
    op.drop_index(
        "ix_user_group_grant_groups_user_group_id", table_name="user_group_grant_groups"
    )
    op.drop_table("grant_group_connections")
    op.drop_table("user_group_grant_groups")
    op.drop_table("grant_groups")
