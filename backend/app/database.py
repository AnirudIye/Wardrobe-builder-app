from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

if settings.database_url.startswith("sqlite"):
    # SQLite needs check_same_thread=False across FastAPI's threadpool.
    engine = create_engine(
        settings.database_url, connect_args={"check_same_thread": False}
    )
else:
    # Managed Postgres (Neon/Supabase/...): pre-ping revalidates connections
    # that the provider's autosuspend has silently killed, and recycling keeps
    # them younger than typical proxy idle timeouts.
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
    )
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
