from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Profile
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Free-form style preferences (e.g. {"styles": ["minimal"], "avoid": ["neon"]})
    style_preferences: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Billing / plan
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    subscription_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    @property
    def is_paid(self) -> bool:
        return self.plan == "paid"
