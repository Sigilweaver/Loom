"""Add connections table

Revision ID: 003_connections
Revises: 002_sessions
Create Date: 2024-12-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_connections"
down_revision: Union[str, None] = "002_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Connections table for Hub-managed database credentials
    op.create_table(
        "connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer, nullable=False),
        sa.Column("database", sa.String(255), nullable=False),
        sa.Column("encrypted_credentials", sa.Text, nullable=False),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Index on name for fast lookups
    op.create_index("ix_connections_name", "connections", ["name"])

    # Index on type for filtering
    op.create_index("ix_connections_type", "connections", ["type"])


def downgrade() -> None:
    op.drop_index("ix_connections_type")
    op.drop_index("ix_connections_name")
    op.drop_table("connections")
