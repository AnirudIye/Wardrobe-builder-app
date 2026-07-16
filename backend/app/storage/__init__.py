from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    """Return the storage backend selected by STORAGE_BACKEND.

    "local" (default) stores under MEDIA_DIR served at /media; "s3" targets
    any S3-compatible store (AWS, Cloudflare R2). The s3 import is lazy so
    boto3 never loads unless selected; required s3 settings are validated
    up-front by the Settings model.
    """
    settings = get_settings()
    if settings.storage_backend == "s3":
        from app.storage.s3 import S3Storage

        return S3Storage(
            bucket=settings.s3_bucket,
            public_base_url=settings.s3_public_base_url,
            endpoint_url=settings.s3_endpoint_url,
            region=settings.s3_region,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
        )
    return LocalStorage(media_dir=settings.media_dir, public_base_url=settings.public_base_url)


__all__ = ["StorageBackend", "LocalStorage", "get_storage"]
