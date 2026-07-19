from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.middleware import SecurityHeadersMiddleware
from app.database import Base, engine
from app.routers import (
    auth,
    billing,
    calendar,
    dresser_ai,
    fits,
    profile,
    recommendations,
    tryon,
    wardrobe,
)

settings = get_settings()


def create_app() -> FastAPI:
    is_prod = settings.is_production
    app = FastAPI(
        title="Wardrobe Builder API",
        version="0.1.0",
        # Interactive docs are a dev tool; don't advertise the API surface in prod.
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        # Auth is a Bearer header, not cookies - nothing needs credentialed CORS.
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    # Added after CORS so it wraps it (last added = outermost): preflight
    # responses get the security headers too.
    app.add_middleware(SecurityHeadersMiddleware, hsts=is_prod)

    # Dev convenience: create tables on startup. Production schema is managed
    # exclusively by `alembic upgrade head` (an explicit release step).
    if not is_prod:
        Base.metadata.create_all(bind=engine)

    # Serve uploaded garment images from local disk. With the s3 backend,
    # media is served by the bucket's public URL instead.
    if settings.storage_backend == "local":
        os.makedirs(settings.media_dir, exist_ok=True)
        app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

    app.include_router(auth.router)
    app.include_router(profile.router)
    app.include_router(wardrobe.router)
    app.include_router(recommendations.router)
    app.include_router(calendar.router)
    app.include_router(fits.router)
    app.include_router(dresser_ai.router)
    app.include_router(tryon.router)
    app.include_router(billing.router)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
