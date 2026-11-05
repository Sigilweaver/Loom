"""Make the database enforce the NOT NULL columns the models declare.

Fifteen columns are non-nullable in app/db/models.py but were created
nullable by earlier migrations, so tests (which build the schema from the
models) enforced constraints production did not. Each column is backfilled
with its model default and then set NOT NULL.

Two columns are not backfilled, because rewriting them would be wrong:
audit_events.details is covered by the audit hash chain, and
execution_records.execution_id identifies the execution a record belongs to.
Hub always writes both, so NULLs are not expected; if any exist the upgrade
stops and says which, and nothing is changed.

Revision ID: 011
Revises: 010
Create Date: 2026-11-05
"""

import sqlalchemy as sa
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None

# table, column, SQL default used to backfill NULLs
_BACKFILL = [
    ("users", "role", "'user'"),
    ("servers", "status", "'unknown'"),
    ("executions", "status", "'queued'"),
    ("schedules", "timezone", "'UTC'"),
    ("schedules", "enabled", "true"),
    ("workflows", "description", "''"),
    ("workflows", "author", "''"),
    ("workflows", "folder_path", "'/'"),
    ("workflows", "tags", "''"),
    ("groups", "description", "''"),
    ("grant_groups", "description", "''"),
    ("execution_records", "connection_ids", "'[]'::jsonb"),
    ("execution_records", "details", "'{}'::jsonb"),
]

# Columns whose NULLs must not be rewritten (see module docstring).
_REQUIRE_NO_NULLS = [
    ("audit_events", "details"),
    ("execution_records", "execution_id"),
]


def upgrade() -> None:
    conn = op.get_bind()
    offending = []
    for table, column in _REQUIRE_NO_NULLS:
        count = conn.execute(
            sa.text(f"SELECT count(*) FROM {table} WHERE {column} IS NULL")
        ).scalar_one()
        if count:
            offending.append(f"{table}.{column} ({count} row(s))")
    if offending:
        raise RuntimeError(
            "Migration 011 found NULLs it will not rewrite: "
            + ", ".join(offending)
            + ". Inspect and fix these rows, then run the upgrade again."
        )

    for table, column, default in _BACKFILL:
        op.execute(f"UPDATE {table} SET {column} = {default} WHERE {column} IS NULL")
        op.alter_column(table, column, nullable=False)
    for table, column in _REQUIRE_NO_NULLS:
        op.alter_column(table, column, nullable=False)


def downgrade() -> None:
    for table, column in [*_REQUIRE_NO_NULLS, *[(t, c) for t, c, _ in _BACKFILL]]:
        op.alter_column(table, column, nullable=True)
