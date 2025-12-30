"""add_server_groups

Revision ID: 010_add_server_groups
Revises: 009_audit_execution_records
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '010_add_server_groups'
down_revision: Union[str, None] = '009_audit_execution_records'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add server_groups join table for Server <-> Group assignment."""
    op.create_table(
        'server_groups',
        sa.Column('server_id', sa.UUID(), nullable=False),
        sa.Column('group_id', sa.UUID(), nullable=False),
        sa.Column(
            'assigned_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column('assigned_by', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('server_id', 'group_id')
    )

    # Add indexes for common queries
    op.create_index('ix_server_groups_server_id', 'server_groups', ['server_id'])
    op.create_index('ix_server_groups_group_id', 'server_groups', ['group_id'])


def downgrade() -> None:
    """Remove server_groups table."""
    op.drop_index('ix_server_groups_group_id', table_name='server_groups')
    op.drop_index('ix_server_groups_server_id', table_name='server_groups')
    op.drop_table('server_groups')
