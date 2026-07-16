from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.recommendation_event import RecommendationEvent
from app.models.user import User

# Human-readable label per metered kind, used in the 402 message.
_LABELS = {
    "buy-next": "buy-next suggestions",
    "dresser-ai": "DresserAI messages",
    "tryon": "try-ons",
}


def used_in_window(db: Session, user: User, kind: str, days: int = 7) -> int:
    """Number of `kind` events served in the trailing `days` days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    count = db.execute(
        select(func.count(RecommendationEvent.id)).where(
            RecommendationEvent.user_id == user.id,
            RecommendationEvent.kind == kind,
            RecommendationEvent.created_at >= since,
        )
    ).scalar_one()
    return int(count)


def remaining(db: Session, user: User, kind: str, limit: int, days: int = 7) -> Optional[int]:
    """Remaining free `kind` actions in the window, or None for unlimited (paid)."""
    if user.is_paid:
        return None
    return max(0, limit - used_in_window(db, user, kind, days))


def enforce(db: Session, user: User, kind: str, limit: int, days: int = 7) -> None:
    """Raise HTTP 402 if a free user has exhausted their `kind` allowance for
    the trailing `days`-day window (7 = weekly, 1 = daily).

    Runs BEFORE any paid API call, so blocked requests cost nothing.
    """
    if user.is_paid:
        return
    if used_in_window(db, user, kind, days) >= limit:
        label = _LABELS.get(kind, kind)
        period = "day" if days == 1 else "week"
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Free plan limit reached ({limit} {label}/{period}). "
                "Upgrade to BetterDresser Plus for unlimited access."
            ),
        )


def record(db: Session, user: User, kind: str) -> None:
    """Log a served action so it counts against its quota window."""
    db.add(RecommendationEvent(user_id=user.id, kind=kind))
    db.commit()
