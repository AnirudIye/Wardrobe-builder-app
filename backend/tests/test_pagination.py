from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, sample_image_bytes


def _upload(client: TestClient, headers: dict, color: str):
    return client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": (f"{color}.png", sample_image_bytes(color), "image/png")},
    )


def test_wardrobe_list_defaults_unchanged(client: TestClient):
    headers = auth_headers(client)
    for c in ["red", "green", "blue"]:
        _upload(client, headers, c)
    rows = client.get("/wardrobe/items", headers=headers).json()
    assert len(rows) == 3  # no params = everything, as the SPA expects


def test_wardrobe_list_limit_and_offset(client: TestClient):
    headers = auth_headers(client)
    ids = [_upload(client, headers, c).json()["id"] for c in ["red", "green", "blue"]]

    page1 = client.get("/wardrobe/items?limit=2", headers=headers).json()
    assert [g["id"] for g in page1] == [ids[2], ids[1]]  # newest first

    page2 = client.get("/wardrobe/items?limit=2&offset=2", headers=headers).json()
    assert [g["id"] for g in page2] == [ids[0]]


def test_wardrobe_list_rejects_bad_limit(client: TestClient):
    headers = auth_headers(client)
    assert client.get("/wardrobe/items?limit=0", headers=headers).status_code == 422
    assert client.get("/wardrobe/items?limit=1001", headers=headers).status_code == 422
    assert client.get("/wardrobe/items?offset=-1", headers=headers).status_code == 422


def test_calendar_list_limit_and_offset(client: TestClient):
    headers = auth_headers(client)
    d0 = date.today()
    for i in range(3):
        client.post(
            "/calendar/events",
            headers=headers,
            json={"title": f"E{i}", "date": (d0 + timedelta(days=i)).isoformat(), "event_type": "casual"},
        )

    assert len(client.get("/calendar/events", headers=headers).json()) == 3
    page = client.get("/calendar/events?limit=2&offset=1", headers=headers).json()
    assert [e["title"] for e in page] == ["E1", "E2"]  # date-ordered window
