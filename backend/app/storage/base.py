from __future__ import annotations

from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Interface for storing and serving binary blobs (garment images).

    A `key` is an opaque relative identifier (e.g. "abc123.jpg"). Callers store
    the key; the public URL is derived from it via `url()`.
    """

    @abstractmethod
    def save(self, data: bytes, key: str) -> str:
        """Persist `data` under `key`; return the key."""

    @abstractmethod
    def url(self, key: str) -> str:
        """Return a publicly reachable URL for a stored key."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        """Return the stored bytes for `key`. Raises FileNotFoundError if missing."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the blob at `key`. Missing keys are ignored."""
