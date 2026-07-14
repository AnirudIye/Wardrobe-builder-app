from __future__ import annotations

import os
import tempfile

# Isolate the test environment BEFORE any app module reads settings.
os.environ["DATABASE_URL"] = "sqlite://"  # module-level engine is unused (get_db is overridden)
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="wardrobe_test_media_")
os.environ["PUBLIC_BASE_URL"] = "http://testserver"
# Blank out all external API keys so tests NEVER hit (or spend) real services,
# regardless of what a developer has in backend/.env. Env vars beat env_file
# in pydantic-settings, so these win.
for _key in (
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "OPENWEATHER_API_KEY",
    "SERPAPI_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
):
    os.environ[_key] = ""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# All models must be imported so Base.metadata knows about them.
import app.models  # noqa: F401
from app.database import Base, get_db
from app.main import app as fastapi_app


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """A fresh in-memory SQLite database per test, shared across connections."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient whose get_db dependency uses the test database."""

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()
