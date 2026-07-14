from __future__ import annotations

import os

from app.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    """Stores blobs on the local filesystem under `media_dir`, served at /media."""

    def __init__(self, media_dir: str, public_base_url: str) -> None:
        self.media_dir = media_dir
        self.public_base_url = public_base_url.rstrip("/")
        os.makedirs(self.media_dir, exist_ok=True)

    def _path(self, key: str) -> str:
        # Guard against path traversal; keys are flat filenames.
        safe_key = os.path.basename(key)
        return os.path.join(self.media_dir, safe_key)

    def save(self, data: bytes, key: str) -> str:
        with open(self._path(key), "wb") as f:
            f.write(data)
        return key

    def url(self, key: str) -> str:
        return f"{self.public_base_url}/media/{os.path.basename(key)}"

    def read(self, key: str) -> bytes:
        with open(self._path(key), "rb") as f:
            return f.read()

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass
