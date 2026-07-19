from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class GarmentTags(BaseModel):
    """The editable tag fields shared by AI output and manual edits."""

    category: Optional[str] = None
    subcategory: Optional[str] = None
    colors: List[str] = Field(default_factory=list)
    pattern: Optional[str] = None
    material: Optional[str] = None
    formality: Optional[str] = None
    warmth_rating: Optional[int] = Field(default=None, ge=1, le=5)
    seasons: List[str] = Field(default_factory=list)


class GarmentUpdate(BaseModel):
    """PATCH body: any subset of tag fields."""

    category: Optional[str] = None
    subcategory: Optional[str] = None
    colors: Optional[List[str]] = None
    pattern: Optional[str] = None
    material: Optional[str] = None
    formality: Optional[str] = None
    warmth_rating: Optional[int] = Field(default=None, ge=1, le=5)
    seasons: Optional[List[str]] = None
    # What the user paid; explicit null clears it. Plain number, no currency.
    price: Optional[float] = Field(default=None, ge=0, le=1_000_000)


class GarmentOut(BaseModel):
    id: int
    image_url: str
    thumbnail_url: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    colors: List[str] = Field(default_factory=list)
    pattern: Optional[str] = None
    material: Optional[str] = None
    formality: Optional[str] = None
    warmth_rating: Optional[int] = None
    seasons: List[str] = Field(default_factory=list)
    price: Optional[float] = None
    created_at: datetime
