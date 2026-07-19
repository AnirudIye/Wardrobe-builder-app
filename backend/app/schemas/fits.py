from __future__ import annotations

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class FitLogIn(BaseModel):
    # The client's local calendar day being logged, and its local "today"
    # (client-supplies-local-date pattern; the server clock is wrong for
    # anyone in another timezone).
    date: date
    today: date
    garment_ids: List[int] = Field(min_length=1, max_length=30)
    source: Literal["recommendation", "manual"] = "manual"
    # Honor-system claim of the day's shared style challenge.
    challenge_done: bool = False


class FitWeekDay(BaseModel):
    date: date
    logged: bool
    source: Optional[str] = None


class FitStatusOut(BaseModel):
    today_logged: bool
    today_source: Optional[str] = None
    today_garment_ids: List[int]
    current_streak: int
    longest_streak: int
    week: List[FitWeekDay]
    week_points: int
    closet_score: int
    # Share of active loggers (trailing 7 days) with fewer logged days than
    # you; None until you have a log in the window.
    percentile: Optional[int] = None
    total_logs: int
    # Today's shared challenge (same for every user on a given date).
    challenge_name: str
    challenge_brief: str
    challenge_done: bool


class WearStatItem(BaseModel):
    garment_id: int
    wears: int
    price: Optional[float] = None
    # price / wears, only when both exist.
    cost_per_wear: Optional[float] = None


class WearStatsOut(BaseModel):
    items: List[WearStatItem]
    # Sum of the prices the user has entered.
    closet_value: float
    # Owned garments that appear in no outfit log yet.
    never_worn: int
