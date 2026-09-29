"""Audit event hash version.

Rows written before this revision were hashed before id and timestamp were
assigned, so their content hash can never be reproduced (Loom#110). They are
marked version 1 (legacy, unverifiable); new rows are written as version 2.

Revision ID: 008
Revises: 007
Create Date: 2026-02-02
"""

import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows are backfilled with 1 by the server default; the default
    # is then dropped so new rows must state their version explicitly.
    op.add_column(
        "audit_events",
        sa.Column("hash_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("audit_events", "hash_version", server_default=None)


def downgrade() -> None:
    op.drop_column("audit_events", "hash_version")
