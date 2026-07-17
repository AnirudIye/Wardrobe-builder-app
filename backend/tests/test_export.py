from __future__ import annotations

import json

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, sample_image_bytes


def test_export_requires_auth(client: TestClient):
    assert client.get("/profile/export").status_code == 401


def test_export_contains_all_user_data(client: TestClient):
    headers = auth_headers(client, email="export@example.com")

    client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("shirt.png", sample_image_bytes(), "image/png")},
    )
    client.post(
        "/calendar/events",
        headers=headers,
        json={"title": "Interview", "date": "2026-08-01", "event_type": "business"},
    )
    client.patch(
        "/profile", headers=headers, json={"style_preferences": {"styles": ["minimal"]}}
    )

    resp = client.get("/profile/export", headers=headers)
    assert resp.status_code == 200, resp.text
    # Browsers should download it as a file.
    assert resp.headers["content-disposition"].startswith("attachment")
    assert "betterdresser-export.json" in resp.headers["content-disposition"]

    data = json.loads(resp.content)
    assert data["profile"]["email"] == "export@example.com"
    assert data["profile"]["style_preferences"] == {"styles": ["minimal"]}
    assert len(data["garments"]) == 1
    assert data["garments"][0]["image_url"]
    assert len(data["calendar_events"]) == 1
    assert data["calendar_events"][0]["title"] == "Interview"
    assert data["calendar_events"][0]["date"] == "2026-08-01"
    assert isinstance(data["usage_events"], list)
    assert data["exported_at"]


def test_export_never_includes_password_hash(client: TestClient):
    headers = auth_headers(client, email="hash@example.com")
    body = client.get("/profile/export", headers=headers).text
    assert "hashed_password" not in body
    assert "$2b$" not in body  # bcrypt prefix
