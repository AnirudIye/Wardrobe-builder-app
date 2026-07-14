from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.recommendation_event import RecommendationEvent
from app.models.user import User

_WINDOW = timedelta(days=7)

# Human-readable label per metered kind, used in the 402 message.
_LABELS = {
    "buy-next": "buy-next suggestions",
    "dresser-ai": "DresserAI messages",
    "tryon": "try-ons",
}


def used_this_week(db: Session, user: User, kind: str) -> int:
    """Number of `kind` events served in the trailing 7 days."""
    since = datetime.now(timezone.utc) - _WINDOW
    count = db.execute(
        select(func.count(RecommendationEvent.id)).where(
            RecommendationEvent.user_id == user.id,
            RecommendationEvent.kind == kind,
            RecommendationEvent.created_at >= since,
        )
    ).scalar_one()
    return int(count)


def remaining(db: Session, user: User, kind: str, limit: int) -> Optional[int]:
    """Remaining free `kind` actions this week, or None for unlimited (paid)."""
    if user.is_paid:
        return None
    return max(0, limit - used_this_week(db, user, kind))


def enforce(db: Session, user: User, kind: str, limit: int) -> None:
    """Raise HTTP 402 if a free user has exhausted their weekly `kind` allowance.

    Runs BEFORE any paid API call, so blocked requests cost nothing.
    """
    if user.is_paid:
        return
    if used_this_week(db, user, kind) >= limit:
        label = _LABELS.get(kind, kind)
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Free plan limit reached ({limit} {label}/week). "
                "Upgrade to BetterDresser Plus for unlimited access."
            ),
        )


def record(db: Session, user: User, kind: str) -> None:
    """Log a served action so it counts against its weekly window."""
    db.add(RecommendationEvent(user_id=user.id, kind=kind))
    db.commit()
