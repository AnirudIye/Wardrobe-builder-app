"""garments (user_id, created_at) index

The wardrobe listing runs `WHERE user_id = ? ORDER BY created_at DESC` on
every page visit; this composite serves it index-ordered with no sort step.
Found by the query audit alongside the earlier quota/calendar composites.

Revision ID: c9d3e51fb202
Revises: b7c21d40aa11
Create Date: 2026-07-18

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c9d3e51fb202'
down_revision = 'b7c21d40aa11'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_garments_user_created', 'garments', ['user_id', 'created_at']
    )


def downgrade() -> None:
    op.drop_index('ix_garments_user_created', table_name='garments')
