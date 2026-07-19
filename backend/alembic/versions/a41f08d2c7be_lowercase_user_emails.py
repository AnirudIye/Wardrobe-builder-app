"""lowercase user emails

Auth now stores and compares emails in lowercase (mailboxes are
case-insensitive in practice; a mixed-case variant could previously
register a second account on the same inbox). This backfills any
pre-existing mixed-case rows so the lowercase lookups still find them.

Refuses to run if two accounts would collapse into the same address -
that collision holds real user data and needs a human decision (merge
or delete), not a silent constraint failure mid-update.

Revision ID: a41f08d2c7be
Revises: c9d3e51fb202
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a41f08d2c7be'
down_revision = 'c9d3e51fb202'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    dupes = conn.execute(
        sa.text(
            "SELECT lower(email) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1"
        )
    ).scalars().all()
    if dupes:
        raise RuntimeError(
            "Cannot lowercase user emails: these addresses exist under multiple "
            f"casings and must be merged or deleted first: {', '.join(dupes)}"
        )
    conn.execute(sa.text("UPDATE users SET email = lower(email) WHERE email != lower(email)"))


def downgrade() -> None:
    # The original casing is gone; lowercase rows are valid either way.
    pass
