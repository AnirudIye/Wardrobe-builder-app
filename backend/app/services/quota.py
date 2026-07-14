from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.recommendation_event import RecommendationEvent
from app.models.user import User

_WINDOW = timedelta(days=7)

# Only buy-next suggestions are metered. "Today" outfit recommendations are
# free and unlimited (they're the app's core loop); events of other kinds are
# still recorded for usage logging but never count against the quota.
_METERED_KIND = "buy-next"


def used_this_week(db: Session, user: User) -> int:
    """Number of metered (buy-next) suggestions served in the trailing 7 days."""
    since = datetime.now(timezone.utc) - _WINDOW
    count = db.execute(
        select(func.count(RecommendationEvent.id)).where(
            RecommendationEvent.user_id == user.id,
            RecommendationEvent.kind == _METERED_KIND,
            RecommendationEvent.created_at >= since,
        )
    ).scalar_one()
    return int(count)


def remaining(db: Session, user: User) -> Optional[int]:
    """Remaining free recommendations this week, or None for unlimited (paid)."""
    if user.is_paid:
        return None
    limit = get_settings().free_weekly_recommendation_limit
    return max(0, limit - used_this_week(db, user))


def enforce(db: Session, user: User) -> None:
    """Raise HTTP 402 if a free user has exhausted their weekly allowance.

    Runs BEFORE any paid API call, so blocked requests cost nothing.
    """
    if user.is_paid:
        return
    limit = get_settings().free_weekly_recommendation_limit
    if used_this_week(db, user) >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Free plan limit reached ({limit} buy-next suggestions/week). "
                "Upgrade to BetterDresser Plus for unlimited suggestions."
            ),
        )


def record(db: Session, user: User, kind: str) -> None:
    """Log a served recommendation so it counts against the weekly window."""
    db.add(RecommendationEvent(user_id=user.id, kind=kind))
    db.commit()
