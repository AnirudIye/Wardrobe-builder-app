from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    """Return the configured storage backend.

    Currently local-disk only; an S3 backend can be selected here later
    (e.g. based on settings) without changing any caller.
    """
    settings = get_settings()
    return LocalStorage(media_dir=settings.media_dir, public_base_url=settings.public_base_url)


__all__ = ["StorageBackend", "LocalStorage", "get_storage"]
