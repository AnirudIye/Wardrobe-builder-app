from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.garment import Garment
from app.models.user import User
from app.schemas.garment import GarmentOut, GarmentUpdate
from app.schemas.recommendation import ProductSuggestion
from app.services import shopping, vision
from app.services.images import (
    ImageDownloadError,
    InvalidImageError,
    download_image_bytes,
    process_upload,
)
from app.storage import get_storage

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


def _serialize(garment: Garment) -> GarmentOut:
    storage = get_storage()
    return GarmentOut(
        id=garment.id,
        image_url=storage.url(garment.image_path),
        thumbnail_url=storage.url(garment.thumbnail_path),
        category=garment.category,
        subcategory=garment.subcategory,
        colors=garment.colors or [],
        pattern=garment.pattern,
        material=garment.material,
        formality=garment.formality,
        warmth_rating=garment.warmth_rating,
        seasons=garment.seasons or [],
        created_at=garment.created_at,
    )


def _get_owned_garment(db: Session, user: User, garment_id: int) -> Garment:
    garment = db.get(Garment, garment_id)
    if garment is None or garment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found")
    return garment


def _create_garment_from_bytes(
    db: Session, user: User, raw: bytes, fallback_subcategory: Optional[str] = None
) -> Garment:
    """Process, store, auto-tag, and persist a garment image (shared by upload + web-add)."""
    try:
        processed = process_upload(raw)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage = get_storage()
    stem = uuid.uuid4().hex
    image_key = storage.save(processed.image_bytes, f"{stem}.jpg")
    thumb_key = storage.save(processed.thumbnail_bytes, f"{stem}_thumb.jpg")

    # Best-effort AI auto-tagging (no-ops to empty tags without an API key).
    tags = vision.auto_tag(processed.image_bytes)

    garment = Garment(
        user_id=user.id,
        image_path=image_key,
        thumbnail_path=thumb_key,
        category=tags.category,
        subcategory=tags.subcategory or fallback_subcategory,
        colors=tags.colors,
        pattern=tags.pattern,
        material=tags.material,
        formality=tags.formality,
        warmth_rating=tags.warmth_rating,
        seasons=tags.seasons,
    )
    db.add(garment)
    db.commit()
    db.refresh(garment)
    return garment


@router.post("/items", response_model=GarmentOut, status_code=status.HTTP_201_CREATED)
async def upload_item(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GarmentOut:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    return _serialize(_create_garment_from_bytes(db, current_user, raw))


@router.get("/search", response_model=List[ProductSuggestion])
def search_clothing(
    q: str = Query(min_length=2, max_length=200),
    current_user: User = Depends(get_current_user),
) -> List[ProductSuggestion]:
    """Search the internet (Google Shopping via SerpAPI) for clothing to add."""
    return shopping.search_products(q, limit=8)


class AddFromWebIn(BaseModel):
    image_url: str = Field(min_length=8, max_length=2000)
    title: Optional[str] = Field(default=None, max_length=200)


@router.post("/items/from-web", response_model=GarmentOut, status_code=status.HTTP_201_CREATED)
def add_item_from_web(
    payload: AddFromWebIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GarmentOut:
    """Add a garment from a product image URL found via /wardrobe/search."""
    try:
        raw = download_image_bytes(payload.image_url)
    except ImageDownloadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    # process_upload validates the bytes are a real image; garbage 404 pages fail cleanly.
    return _serialize(
        _create_garment_from_bytes(db, current_user, raw, fallback_subcategory=payload.title)
    )


@router.get("/items", response_model=list[GarmentOut])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GarmentOut]:
    rows = db.execute(
        select(Garment)
        .where(Garment.user_id == current_user.id)
        .order_by(Garment.created_at.desc())
    ).scalars().all()
    return [_serialize(g) for g in rows]


@router.get("/items/{garment_id}", response_model=GarmentOut)
def get_item(
    garment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GarmentOut:
    return _serialize(_get_owned_garment(db, current_user, garment_id))


@router.patch("/items/{garment_id}", response_model=GarmentOut)
def update_item(
    garment_id: int,
    payload: GarmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GarmentOut:
    garment = _get_owned_garment(db, current_user, garment_id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(garment, field, value)
    db.commit()
    db.refresh(garment)
    return _serialize(garment)


@router.delete(
    "/items/{garment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_item(
    garment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    garment = _get_owned_garment(db, current_user, garment_id)
    storage = get_storage()
    storage.delete(garment.image_path)
    storage.delete(garment.thumbnail_path)
    db.delete(garment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
