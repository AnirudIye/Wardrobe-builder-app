from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.models.recommendation_event import RecommendationEvent
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


def test_delete_account_removes_user_and_data(client: TestClient, db_session: Session):
    headers = auth_headers(client, email="del@example.com")
    uid = client.get("/auth/me", headers=headers).json()["id"]

    item = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("a.png", sample_image_bytes(), "image/png")},
    )
    assert item.status_code in (200, 201), item.text
    # Capture the on-disk media path so we can prove the file is really gone.
    thumb_url = item.json()["thumbnail_url"]
    thumb_path = "/media/" + thumb_url.split("/media/", 1)[1]
    assert client.get(thumb_path).status_code == 200

    client.post(
        "/calendar/events",
        headers=headers,
        json={"title": "Thing", "date": "2026-07-14", "event_type": "casual"},
    )
    # Insert a recommendation event directly so its cleanup is verified too.
    db_session.add(RecommendationEvent(user_id=uid, kind="buy-next"))
    db_session.commit()

    resp = client.delete("/profile", headers=headers)
    assert resp.status_code == 204

    # Token now resolves to a deleted user → 401.
    assert client.get("/auth/me", headers=headers).status_code == 401

    # All of the user's data is actually gone — not just the account row.
    assert db_session.execute(
        select(Garment).where(Garment.user_id == uid)
    ).scalars().all() == []
    assert db_session.execute(
        select(CalendarEvent).where(CalendarEvent.user_id == uid)
    ).scalars().all() == []
    assert db_session.execute(
        select(RecommendationEvent).where(RecommendationEvent.user_id == uid)
    ).scalars().all() == []

    # The stored garment image file is deleted from disk as well.
    assert client.get(thumb_path).status_code == 404
