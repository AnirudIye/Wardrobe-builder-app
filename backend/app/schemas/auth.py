from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    email_verified: bool
    city: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    plan: str
    subscription_status: Optional[str] = None
    current_period_end: Optional[datetime] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
