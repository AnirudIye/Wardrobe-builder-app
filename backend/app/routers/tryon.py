from __future__ import annotations

import base64
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.routers.wardrobe import _get_owned_garment
from app.schemas.tryon import TryOnOut
from app.services import quota, tryon
from app.services.images import (
    ImageDownloadError,
    InvalidImageError,
    download_image_bytes,
    process_upload,
)
from app.storage import get_storage

router = APIRouter(prefix="/tryon", tags=["tryon"])


@router.post("", response_model=TryOnOut)
async def try_on(
    photo: UploadFile = File(...),
    garment_id: Optional[int] = Form(default=None),
    image_url: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TryOnOut:
    if (garment_id is None) == (image_url is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide exactly one of garment_id or image_url.",
        )

    settings = get_settings()
    # 402 before any paid API call.
    quota.enforce(db, current_user, "tryon", settings.free_weekly_tryon_limit)

    raw_photo = await photo.read()
    if not raw_photo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty photo")
    try:
        processed_photo = process_upload(raw_photo)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if garment_id is not None:
        garment = _get_owned_garment(db, current_user, garment_id)
        garment_url = get_storage().url(garment.image_path)
    else:
        garment_url = image_url  # type: ignore[assignment]

    try:
        garment_bytes = download_image_bytes(garment_url)
    except ImageDownloadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    result = tryon.generate_tryon(processed_photo.image_bytes, garment_bytes)
    if result is None:
        # Generation failed / no key — don't charge the user's quota for nothing.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Try-on generation is unavailable right now — check back later.",
        )
    quota.record(db, current_user, "tryon")
    return TryOnOut(image_base64=base64.b64encode(result).decode("ascii"))
