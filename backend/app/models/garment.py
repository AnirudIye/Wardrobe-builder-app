from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Garment(Base):
    __tablename__ = "garments"
    # The wardrobe listing runs `WHERE user_id = ? ORDER BY created_at DESC`
    # on every visit; the composite serves it index-ordered, no sort step.
    __table_args__ = (Index("ix_garments_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Storage keys (opaque); public URLs are derived via the storage backend.
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(String(255), nullable=False)

    # Tags (set manually or by the vision service). All optional.
    category: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    colors: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    pattern: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    material: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    formality: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    warmth_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seasons: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
