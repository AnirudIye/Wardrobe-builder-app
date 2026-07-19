from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RecommendationEvent(Base):
    """One row per served recommendation - the source of truth for weekly usage."""

    __tablename__ = "recommendation_events"
    # Quota counting runs `WHERE user_id = ? AND kind = ? AND created_at > ?`
    # on every metered request (and three times per billing-status call) - the
    # composite index serves it without scanning a user's whole history.
    __table_args__ = (
        Index("ix_recommendation_events_user_kind_created", "user_id", "kind", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # "today" | "buy-next"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True, nullable=False
    )
