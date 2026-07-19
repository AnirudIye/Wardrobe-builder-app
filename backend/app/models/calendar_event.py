from __future__ import annotations

from datetime import date as date_type, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CalendarEvent(Base):
    """An event the user is attending; outfit suggestions consider its dress code."""

    __tablename__ = "calendar_events"
    # Today's-events lookup runs `WHERE user_id = ? AND date = ?` on every
    # recommendation and chat request - serve it with one composite index.
    __table_args__ = (Index("ix_calendar_events_user_date", "user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[date_type] = mapped_column(Date, index=True, nullable=False)
    # Dress code, matching garment formality values.
    event_type: Mapped[str] = mapped_column(String(30), default="casual", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
