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
    created_at: datetime
