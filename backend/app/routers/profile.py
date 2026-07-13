from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services import trends, weather
from app.services.weather import WeatherServiceError, WeatherSnapshot

router = APIRouter(tags=["profile"])


def _parse_prefs(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def _serialize(user: User) -> ProfileOut:
    return ProfileOut(
        id=user.id,
        email=user.email,
        city=user.city,
        lat=user.lat,
        lon=user.lon,
        style_preferences=_parse_prefs(user.style_preferences),
        plan=user.plan,
    )


@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: User = Depends(get_current_user)) -> ProfileOut:
    return _serialize(current_user)


@router.patch("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    changes = payload.model_dump(exclude_unset=True)
    if "style_preferences" in changes:
        prefs = changes.pop("style_preferences")
        current_user.style_preferences = json.dumps(prefs) if prefs is not None else None
    for field, value in changes.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return _serialize(current_user)


@router.get("/trends")
def current_trends(current_user: User = Depends(get_current_user)) -> dict:
    return {"summary": trends.get_trends()}


@router.get("/weather", response_model=WeatherSnapshot)
def current_weather(
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
    current_user: User = Depends(get_current_user),
) -> WeatherSnapshot:
    # Use query coordinates if given, else the user's saved location.
    use_lat = lat if lat is not None else current_user.lat
    use_lon = lon if lon is not None else current_user.lon
    if use_lat is None or use_lon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No location set. Update your profile or pass lat/lon.",
        )
    try:
        return weather.get_weather(use_lat, use_lon)
    except WeatherServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
