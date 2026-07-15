from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, sample_image_bytes


def test_avatar_upload_then_remove(client: TestClient):
    headers = auth_headers(client, email="av@example.com")
    up = client.post(
        "/profile/avatar",
        headers=headers,
        files={"file": ("a.png", sample_image_bytes(), "image/png")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["avatar_url"]

    rm = client.delete("/profile/avatar", headers=headers)
    assert rm.status_code == 200
    assert rm.json()["avatar_url"] is None


def test_avatar_upload_rejects_non_image(client: TestClient):
    headers = auth_headers(client, email="av2@example.com")
    bad = client.post(
        "/profile/avatar",
        headers=headers,
        files={"file": ("x.txt", b"not an image", "text/plain")},
    )
    assert bad.status_code == 400


def test_change_password(client: TestClient):
    headers = auth_headers(client, email="pw@example.com", password="supersecret1")

    wrong = client.post(
        "/profile/password",
        headers=headers,
        json={"current_password": "wrongpass1", "new_password": "brandnew123"},
    )
    assert wrong.status_code == 400

    ok = client.post(
        "/profile/password",
        headers=headers,
        json={"current_password": "supersecret1", "new_password": "brandnew123"},
    )
    assert ok.status_code == 200

    # Old password no longer works; new one does.
    assert client.post(
        "/auth/login", data={"username": "pw@example.com", "password": "supersecret1"}
    ).status_code == 401
    assert client.post(
        "/auth/login", data={"username": "pw@example.com", "password": "brandnew123"}
    ).status_code == 200


def test_delete_account_removes_user_and_data(client: TestClient):
    headers = auth_headers(client, email="del@example.com")
    client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("a.png", sample_image_bytes(), "image/png")},
    )
    client.post(
        "/calendar/events",
        headers=headers,
        json={"title": "Thing", "date": "2026-07-14", "event_type": "casual"},
    )

    resp = client.delete("/profile", headers=headers)
    assert resp.status_code == 204

    # Token now resolves to a deleted user → 401.
    assert client.get("/auth/me", headers=headers).status_code == 401
