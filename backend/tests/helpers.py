from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image


def auth_headers(client: TestClient, email: str = "user@example.com", password: str = "supersecret1") -> dict:
    """Register (idempotently) + log in, returning an Authorization header."""
    client.post("/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def sample_image_bytes(color: str = "red", size: tuple = (600, 800)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()
