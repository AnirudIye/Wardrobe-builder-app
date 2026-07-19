from __future__ import annotations

from datetime import date as date_type, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OutfitLog(Base):
    """One "I wore this" record per user per client-local day.

    `date` is the client's local calendar day (client-supplies-local-date
    pattern, same as /recommendations/today) - never derived from UTC
    timestamps, or streaks would break across timezones. The unique
    constraint makes re-logging a day an upsert, and streak math treats the
    table as its single source of truth (no denormalized counters).
    """

    __tablename__ = "outfit_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_outfit_logs_user_date"),
        # Streak/status reads are always `WHERE user_id = ?` scans over dates.
        Index("ix_outfit_logs_user_date", "user_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    # Owned garment ids worn that day (validated against ownership on write).
    garment_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # "recommendation" (one tap on Today's pick) or "manual" (picker).
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
