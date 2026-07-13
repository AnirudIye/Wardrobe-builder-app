from __future__ import annotations

from datetime import date as date_type, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

EventType = Literal["athletic", "casual", "smart-casual", "business", "formal"]


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: date_type
    event_type: EventType = "casual"
    notes: Optional[str] = Field(default=None, max_length=1000)


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[date_type] = None
    event_type: Optional[EventType] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: date_type
    event_type: str
    notes: Optional[str] = None
    created_at: datetime
