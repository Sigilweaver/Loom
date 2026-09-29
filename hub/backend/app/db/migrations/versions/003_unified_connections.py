"""Unify connections and file paths into single Connection abstraction.

This migration:
1. Extends connections table with description, read_only fields
2. Creates connection_databases table (extracts db-specific fields)
3. Creates connection_filesystems table
4. Migrates existing connection data to new schema
5. Migrates file_paths to connections with type='filesystem'
6. Drops old columns from connections
7. Drops file_paths and grant_group_file_paths tables

Revision ID: 003
Revises: 002
Create Date: 2026-01-03
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === Step 1: Add new columns to connections ===
    op.add_column(
        "connections",
        sa.Column("description", sa.Text, server_default="", nullable=False),
    )
    op.add_column(
        "connections",
        sa.Column("read_only", sa.Boolean, server_default=sa.false(), nullable=False),
    )

    # === Step 2: Create connection_databases table ===
    op.create_table(
        "connection_databases",
        sa.Column(
            "connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("connections.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("db_type", sa.String(20), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer, nullable=False),
        sa.Column("database", sa.String(255), nullable=False),
        sa.Column("encrypted_credentials", sa.Text, nullable=False),
    )

    # === Step 3: Create connection_filesystems table ===
    op.create_table(
        "connection_filesystems",
        sa.Column(
            "connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("connections.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("path", sa.String(1024), nullable=False),
        sa.Column("path_type", sa.String(20), nullable=False, server_default="local"),
    )

    # === Step 4: Migrate existing connection data ===
    # Copy db-specific fields to connection_databases
    op.execute("""
        INSERT INTO connection_databases
            (connection_id, db_type, host, port, database, encrypted_credentials)
        SELECT id, type, host, port, database, encrypted_credentials
        FROM connections
    """)

    # Update type from 'postgresql'/'mysql'/etc to 'database'
    op.execute("""
        UPDATE connections
        SET type = 'database'
    """)

    # === Step 5: Drop old columns from connections BEFORE migrating file_paths ===
    # (These columns have NOT NULL constraints that would block the INSERT)
    op.drop_column("connections", "host")
    op.drop_column("connections", "port")
    op.drop_column("connections", "database")
    op.drop_column("connections", "encrypted_credentials")

    # === Step 6: Migrate file_paths to connections ===
    # Insert file_paths as connections with type='filesystem'
    op.execute("""
        INSERT INTO connections
            (id, name, type, description, read_only, status, created_by, created_at, updated_at)
        SELECT id, name, 'filesystem', description, read_only, 'unknown',
               created_by, created_at, updated_at
        FROM file_paths
    """)

    # Create connection_filesystems entries for migrated file_paths
    op.execute("""
        INSERT INTO connection_filesystems (connection_id, path, path_type)
        SELECT id, path, path_type
        FROM file_paths
    """)

    # Migrate grant_group_file_paths to grant_group_connections
    op.execute("""
        INSERT INTO grant_group_connections
            (grant_group_id, connection_id, assigned_at, assigned_by)
        SELECT grant_group_id, file_path_id, assigned_at, assigned_by
        FROM grant_group_file_paths
        ON CONFLICT DO NOTHING
    """)

    # === Step 7: Drop file_paths tables ===
    op.drop_table("grant_group_file_paths")
    op.drop_table("file_paths")


def downgrade() -> None:
    # Recreate file_paths table
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

    # Recreate grant_group_file_paths table
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

    # Add back old columns to connections
    op.add_column(
        "connections",
        sa.Column("host", sa.String(255), nullable=True),
    )
    op.add_column(
        "connections",
        sa.Column("port", sa.Integer, nullable=True),
    )
    op.add_column(
        "connections",
        sa.Column("database", sa.String(255), nullable=True),
    )
    op.add_column(
        "connections",
        sa.Column("encrypted_credentials", sa.Text, nullable=True),
    )

    # Migrate filesystem connections back to file_paths
    op.execute("""
        INSERT INTO file_paths
            (id, name, path, path_type, description, read_only, created_by, created_at, updated_at)
        SELECT c.id, c.name, cf.path, cf.path_type, c.description, c.read_only,
               c.created_by, c.created_at, c.updated_at
        FROM connections c
        JOIN connection_filesystems cf ON c.id = cf.connection_id
        WHERE c.type = 'filesystem'
    """)

    # Migrate grant_group_connections for filesystems back to grant_group_file_paths
    op.execute("""
        INSERT INTO grant_group_file_paths (grant_group_id, file_path_id, assigned_at, assigned_by)
        SELECT ggc.grant_group_id, ggc.connection_id, ggc.assigned_at, ggc.assigned_by
        FROM grant_group_connections ggc
        JOIN connections c ON ggc.connection_id = c.id
        WHERE c.type = 'filesystem'
    """)

    # Delete filesystem connections from grant_group_connections and connections
    op.execute("""
        DELETE FROM grant_group_connections
        WHERE connection_id IN (SELECT id FROM connections WHERE type = 'filesystem')
    """)
    op.execute("""
        DELETE FROM connections WHERE type = 'filesystem'
    """)

    # Migrate database connections back to flat structure
    op.execute("""
        UPDATE connections c
        SET
            type = cd.db_type,
            host = cd.host,
            port = cd.port,
            database = cd.database,
            encrypted_credentials = cd.encrypted_credentials
        FROM connection_databases cd
        WHERE c.id = cd.connection_id
    """)

    # Make columns non-nullable now that data is restored
    op.alter_column("connections", "host", nullable=False)
    op.alter_column("connections", "port", nullable=False)
    op.alter_column("connections", "database", nullable=False)
    op.alter_column("connections", "encrypted_credentials", nullable=False)

    # Drop new tables
    op.drop_table("connection_filesystems")
    op.drop_table("connection_databases")

    # Drop new columns
    op.drop_column("connections", "description")
    op.drop_column("connections", "read_only")
