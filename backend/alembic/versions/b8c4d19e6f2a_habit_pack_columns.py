"""habit pack columns: garments.price + outfit_logs.challenge_done

Cost-per-wear needs a user-entered price on garments; daily challenges
need an honor-system claim flag on each day's outfit log.
See docs/superpowers/specs/2026-07-18-habit-pack-design.md.

Revision ID: b8c4d19e6f2a
Revises: e7a92b3f4c1d
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8c4d19e6f2a'
down_revision = 'e7a92b3f4c1d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('garments', sa.Column('price', sa.Float(), nullable=True))
    op.add_column(
        'outfit_logs',
        sa.Column(
            'challenge_done',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('outfit_logs', 'challenge_done')
    op.drop_column('garments', 'price')
