from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, engine
from app.routers import (
    auth,
    billing,
    calendar,
    dresser_ai,
    profile,
    recommendations,
    tryon,
    wardrobe,
)

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(title="Wardrobe Builder API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_base_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Dev convenience: create tables on startup. Production uses Alembic migrations.
    Base.metadata.create_all(bind=engine)

    # Serve uploaded garment images.
    os.makedirs(settings.media_dir, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

    app.include_router(auth.router)
    app.include_router(profile.router)
    app.include_router(wardrobe.router)
    app.include_router(recommendations.router)
    app.include_router(calendar.router)
    app.include_router(dresser_ai.router)
    app.include_router(tryon.router)
    app.include_router(billing.router)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
