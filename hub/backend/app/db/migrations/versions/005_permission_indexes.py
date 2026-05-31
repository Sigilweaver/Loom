"""Add hot-path indexes for permission resolution.

Adds btree indexes on columns used by connection-list / audit / permission
joins to eliminate sequential scans at scale. Safe to apply on existing
deployments - all indexes are additive.

Revision ID: 005
Revises: 004
Create Date: 2026-05-22
"""

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Connection list filters/sorts by status frequently.
    op.create_index(
        "idx_connections_status",
        "connections",
        ["status"],
    )

    # Audit timeline queries fetch newest-first.
    op.create_index(
        "idx_audit_events_timestamp",
        "audit_events",
        ["timestamp"],
    )

    # user_groups PK is (user_id, group_id); reverse-direction lookups by
    # group_id alone need their own index. user_id-leading is covered by
    # the PK but added explicitly for clarity and to support partial-scan
    # planners.
    op.create_index(
        "idx_user_groups_user",
        "user_groups",
        ["user_id"],
    )
    op.create_index(
        "idx_user_groups_group",
        "user_groups",
        ["group_id"],
    )

    # Same shape for the permission join tables. PK already covers the
    # leading column lookups; add reverse-direction indexes so we can
    # walk "given a grant_group, who has it" and "given a connection,
    # which grant_groups reference it" efficiently.
    op.create_index(
        "idx_uggg_lookup",
        "user_group_grant_groups",
        ["user_group_id", "grant_group_id"],
    )
    op.create_index(
        "idx_uggg_grant_group",
        "user_group_grant_groups",
        ["grant_group_id"],
    )
    op.create_index(
        "idx_gg_conn_lookup",
        "grant_group_connections",
        ["grant_group_id", "connection_id"],
    )
    op.create_index(
        "idx_gg_conn_reverse",
        "grant_group_connections",
        ["connection_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_gg_conn_reverse", table_name="grant_group_connections")
    op.drop_index("idx_gg_conn_lookup", table_name="grant_group_connections")
    op.drop_index("idx_uggg_grant_group", table_name="user_group_grant_groups")
    op.drop_index("idx_uggg_lookup", table_name="user_group_grant_groups")
    op.drop_index("idx_user_groups_group", table_name="user_groups")
    op.drop_index("idx_user_groups_user", table_name="user_groups")
    op.drop_index("idx_audit_events_timestamp", table_name="audit_events")
    op.drop_index("idx_connections_status", table_name="connections")
