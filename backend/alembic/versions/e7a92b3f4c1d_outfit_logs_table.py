"""outfit_logs table

Fit-streak feature: one "I wore this" row per user per client-local day.
The (user_id, date) unique constraint makes re-logging an upsert; the
composite index serves the per-user date scans that streak math runs.
See docs/superpowers/specs/2026-07-18-fit-streak-design.md.

Revision ID: e7a92b3f4c1d
Revises: a41f08d2c7be
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a92b3f4c1d'
down_revision = 'a41f08d2c7be'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'outfit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('garment_ids', sa.JSON(), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'date', name='uq_outfit_logs_user_date'),
    )
    op.create_index('ix_outfit_logs_user_id', 'outfit_logs', ['user_id'])
    op.create_index('ix_outfit_logs_user_date', 'outfit_logs', ['user_id', 'date'])


def downgrade() -> None:
    op.drop_index('ix_outfit_logs_user_date', table_name='outfit_logs')
    op.drop_index('ix_outfit_logs_user_id', table_name='outfit_logs')
    op.drop_table('outfit_logs')
