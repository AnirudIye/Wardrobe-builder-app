from __future__ import annotations

from datetime import date as date_type, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.garment import Garment
from app.models.outfit_log import OutfitLog
from app.models.user import User
from app.schemas.fits import FitLogIn, FitStatusOut, WearStatsOut
from app.services import streaks
from app.services.challenges import challenge_for
from app.services.closet_score import closet_score

router = APIRouter(prefix="/fits", tags=["fits"])

# Streak logging is deliberately free and unmetered: it is the daily habit
# loop, costs no external API call, and must never gate on plan.


def _status_payload(db: Session, user: User, today: date_type) -> dict:
    logs = list(
        db.execute(select(OutfitLog).where(OutfitLog.user_id == user.id)).scalars().all()
    )
    by_date = {log.date: log for log in logs}
    logged_dates = set(by_date)

    monday = today - timedelta(days=today.weekday())
    week_garments: set = set()
    week_days = 0
    week_challenges = 0
    for i in range(7):
        log = by_date.get(monday + timedelta(days=i))
        if log is not None:
            week_days += 1
            week_garments.update(log.garment_ids or [])
            if log.challenge_done:
                week_challenges += 1

    garments = list(
        db.execute(select(Garment).where(Garment.user_id == user.id)).scalars().all()
    )

    today_log = by_date.get(today)
    challenge = challenge_for(today)
    return {
        "today_logged": today_log is not None,
        "today_source": today_log.source if today_log else None,
        "today_garment_ids": list(today_log.garment_ids or []) if today_log else [],
        "current_streak": streaks.current_streak(logged_dates, today),
        "longest_streak": streaks.longest_streak(logged_dates),
        "week": streaks.week_grid({d: log.source for d, log in by_date.items()}, today),
        "week_points": streaks.week_points(week_days, len(week_garments), week_challenges),
        "closet_score": closet_score(garments),
        "percentile": _weekly_percentile(db, user, today),
        "total_logs": len(logs),
        "challenge_name": challenge["name"],
        "challenge_brief": challenge["brief"],
        "challenge_done": bool(today_log.challenge_done) if today_log else False,
    }


def _weekly_percentile(db: Session, user: User, today: date_type) -> Optional[int]:
    """Share of active loggers (trailing 7 days) with fewer days than you.

    One GROUP BY over outfit_logs - the table stays the single source of
    truth, no denormalized counters (same philosophy as quota).
    """
    window_start = today - timedelta(days=6)
    rows = db.execute(
        select(OutfitLog.user_id, func.count(OutfitLog.id))
        .where(OutfitLog.date >= window_start, OutfitLog.date <= today)
        .group_by(OutfitLog.user_id)
    ).all()
    counts = {user_id: count for user_id, count in rows}
    mine = counts.get(user.id)
    if not mine:
        return None
    fewer = sum(1 for count in counts.values() if count < mine)
    return round(100 * fewer / len(counts))


@router.get("/status", response_model=FitStatusOut)
def fit_status(
    # The client's local date (same pattern as /recommendations/today).
    date: Optional[date_type] = Query(default=None, description="Client-local date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    today = date if date is not None else date_type.today()
    return _status_payload(db, current_user, today)


@router.post("/log", response_model=FitStatusOut)
def log_fit(
    payload: FitLogIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # The claimed client "today" must be plausible against the server clock:
    # [utc - 2, utc + 1] covers every real timezone (UTC-12 through UTC+14).
    server_today = datetime.now(timezone.utc).date()
    if not (server_today - timedelta(days=2) <= payload.today <= server_today + timedelta(days=1)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That date doesn't look right. Check your device's clock and try again.",
        )
    # Grace window: today or yesterday only. Older days can't be backfilled,
    # or streaks would be editable history rather than a daily habit.
    if not (payload.today - timedelta(days=1) <= payload.date <= payload.today):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only log today's or yesterday's outfit.",
        )

    garment_ids = list(dict.fromkeys(payload.garment_ids))  # dedupe, keep order
    owned = set(
        db.execute(
            select(Garment.id).where(
                Garment.user_id == current_user.id, Garment.id.in_(garment_ids)
            )
        ).scalars()
    )
    if len(owned) != len(garment_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found"
        )

    existing = db.execute(
        select(OutfitLog).where(
            OutfitLog.user_id == current_user.id, OutfitLog.date == payload.date
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.garment_ids = garment_ids
        existing.source = payload.source
        existing.challenge_done = payload.challenge_done
    else:
        db.add(
            OutfitLog(
                user_id=current_user.id,
                date=payload.date,
                garment_ids=garment_ids,
                source=payload.source,
                challenge_done=payload.challenge_done,
            )
        )
    db.commit()
    return _status_payload(db, current_user, payload.today)


@router.get("/wear-stats", response_model=WearStatsOut)
def wear_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cost-per-wear over the wear log. garment_ids live in JSON, which
    SQLite can't index into, so wears are counted in Python - the same
    full-scan scale the streak math already accepts (~365 rows/user/year)."""
    logs = db.execute(
        select(OutfitLog).where(OutfitLog.user_id == current_user.id)
    ).scalars()
    wears: dict = {}
    for log in logs:
        for garment_id in log.garment_ids or []:
            wears[garment_id] = wears.get(garment_id, 0) + 1

    garments = list(
        db.execute(select(Garment).where(Garment.user_id == current_user.id)).scalars()
    )
    items = []
    closet_value = 0.0
    never_worn = 0
    for garment in garments:
        count = wears.get(garment.id, 0)
        if count == 0:
            never_worn += 1
        if garment.price is not None:
            closet_value += garment.price
        items.append(
            {
                "garment_id": garment.id,
                "wears": count,
                "price": garment.price,
                "cost_per_wear": round(garment.price / count, 2)
                if garment.price is not None and count > 0
                else None,
            }
        )
    return {"items": items, "closet_value": closet_value, "never_worn": never_worn}
