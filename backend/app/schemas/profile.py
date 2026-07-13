from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    city: Optional[str] = Field(default=None, max_length=120)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    # Free-form style preferences, e.g. {"styles": ["minimal"], "avoid": ["neon"]}
    style_preferences: Optional[dict] = None


class ProfileOut(BaseModel):
    id: int
    email: str
    city: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    style_preferences: Optional[dict] = None
    plan: str
