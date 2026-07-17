"""composite hot-path indexes

Two composite indexes matching the hottest per-request queries:

- recommendation_events (user_id, kind, created_at): quota counting runs
  `WHERE user_id = ? AND kind = ? AND created_at > ?` on every metered
  request and three times per billing-status call.
- calendar_events (user_id, date): today's-events lookup runs on every
  recommendation and DresserAI chat request.

The single-column indexes from the baseline stay (other queries use them).

Revision ID: b7c21d40aa11
Revises: fd5045a8a55c
Create Date: 2026-07-17

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'b7c21d40aa11'
down_revision = 'fd5045a8a55c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_recommendation_events_user_kind_created',
        'recommendation_events',
        ['user_id', 'kind', 'created_at'],
    )
    op.create_index(
        'ix_calendar_events_user_date',
        'calendar_events',
        ['user_id', 'date'],
    )


def downgrade() -> None:
    op.drop_index('ix_calendar_events_user_date', table_name='calendar_events')
    op.drop_index(
        'ix_recommendation_events_user_kind_created', table_name='recommendation_events'
    )
