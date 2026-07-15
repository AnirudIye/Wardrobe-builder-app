from __future__ import annotations

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.models.recommendation_event import RecommendationEvent
from app.models.user import User
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services import trends, weather
from app.services.images import InvalidImageError, process_upload
from app.storage import get_storage
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
    storage = get_storage()
    return ProfileOut(
        id=user.id,
        email=user.email,
        city=user.city,
        lat=user.lat,
        lon=user.lon,
        style_preferences=_parse_prefs(user.style_preferences),
        plan=user.plan,
        avatar_url=storage.url(user.avatar_key) if user.avatar_key else None,
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


class LocationIn(BaseModel):
    city: str = Field(min_length=2, max_length=120)


@router.post("/profile/location", response_model=ProfileOut)
def set_location(
    payload: LocationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    """Set the user's location by city name (geocoded via OpenWeather)."""
    try:
        place = weather.geocode(payload.city)
    except WeatherServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    current_user.city = place.name
    current_user.lat = place.lat
    current_user.lon = place.lon
    db.commit()
    db.refresh(current_user)
    return _serialize(current_user)


@router.post("/profile/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    try:
        processed = process_upload(raw)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage = get_storage()
    old_key = current_user.avatar_key
    key = storage.save(processed.thumbnail_bytes, f"avatar_{uuid.uuid4().hex}.jpg")
    current_user.avatar_key = key
    db.commit()
    db.refresh(current_user)
    if old_key:
        storage.delete(old_key)
    return _serialize(current_user)


@router.delete("/profile/avatar", response_model=ProfileOut)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    if current_user.avatar_key:
        get_storage().delete(current_user.avatar_key)
        current_user.avatar_key = None
        db.commit()
        db.refresh(current_user)
    return _serialize(current_user)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/profile/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated"}


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Permanently delete the account and all of its data."""
    storage = get_storage()
    garments = db.execute(
        select(Garment).where(Garment.user_id == current_user.id)
    ).scalars().all()
    for g in garments:
        storage.delete(g.image_path)
        storage.delete(g.thumbnail_path)
    if current_user.avatar_key:
        storage.delete(current_user.avatar_key)

    db.execute(delete(Garment).where(Garment.user_id == current_user.id))
    db.execute(delete(CalendarEvent).where(CalendarEvent.user_id == current_user.id))
    db.execute(delete(RecommendationEvent).where(RecommendationEvent.user_id == current_user.id))
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
