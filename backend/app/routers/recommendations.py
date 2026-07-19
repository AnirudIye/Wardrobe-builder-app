from __future__ import annotations

import json
from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.models.user import User
from app.routers.wardrobe import _serialize as serialize_garment
from app.schemas.recommendation import (
    BuyNextItem,
    BuyNextOut,
    OutfitRecommendationOut,
)
from app.services import quota, recommendation, shopping, trends, weather
from app.services.weather import WeatherServiceError, WeatherSnapshot

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _user_garments(db: Session, user: User) -> List[Garment]:
    return list(
        db.execute(select(Garment).where(Garment.user_id == user.id)).scalars().all()
    )


def _user_prefs(user: User) -> Optional[dict]:
    if not user.style_preferences:
        return None
    try:
        return json.loads(user.style_preferences)
    except (json.JSONDecodeError, TypeError):
        return None


def _best_effort_weather(
    user: User, lat: Optional[float], lon: Optional[float]
) -> Optional[WeatherSnapshot]:
    use_lat = lat if lat is not None else user.lat
    use_lon = lon if lon is not None else user.lon
    if use_lat is None or use_lon is None:
        return None
    try:
        return weather.get_weather(use_lat, use_lon)
    except WeatherServiceError:
        return None


@router.get("/today", response_model=OutfitRecommendationOut)
def today(
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
    date: Optional[date_type] = Query(
        default=None,
        description="The user's local date (YYYY-MM-DD). Defaults to the server's "
        "date if omitted, which may be wrong for the caller's timezone.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OutfitRecommendationOut:
    garments = _user_garments(db, current_user)
    if not garments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your wardrobe is empty - add some items first.",
        )
    # Today's outfit is free and unlimited - only buy-next is quota-metered.
    snapshot = _best_effort_weather(current_user, lat, lon)
    target_date = date if date is not None else date_type.today()
    todays_events = list(
        db.execute(
            select(CalendarEvent).where(
                CalendarEvent.user_id == current_user.id,
                CalendarEvent.date == target_date,
            )
        ).scalars().all()
    )
    result = recommendation.recommend_outfit(
        garments=garments,
        weather=snapshot,
        trend_summary=None,
        prefs=_user_prefs(current_user),
        events=todays_events,
    )
    by_id = {g.id: g for g in garments}
    items = [serialize_garment(by_id[i]) for i in result.garment_ids if i in by_id]
    quota.record(db, current_user, "today")
    return OutfitRecommendationOut(
        items=items,
        rationale=result.rationale,
        source=result.source,
        weather=snapshot,
    )


@router.get("/buy-next", response_model=BuyNextOut)
def buy_next(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BuyNextOut:
    settings = get_settings()
    # 402 before any paid API call (buy-next is metered per day, not per week)
    quota.enforce(db, current_user, "buy-next", settings.free_daily_recommendation_limit, days=1)
    garments = _user_garments(db, current_user)
    trend_summary = trends.get_trends()
    suggestions, source = recommendation.suggest_purchases(
        garments=garments,
        trend_summary=trend_summary,
        prefs=_user_prefs(current_user),
    )
    items = [
        BuyNextItem(
            description=s.description,
            rationale=s.rationale,
            products=shopping.search_products(s.query),
            search_url=shopping.google_shopping_url(s.query),
        )
        for s in suggestions
    ]
    quota.record(db, current_user, "buy-next")
    return BuyNextOut(suggestions=items, source=source)
