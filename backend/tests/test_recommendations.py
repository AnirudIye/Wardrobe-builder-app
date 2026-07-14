from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.services.recommendation import _target_warmth, heuristic_outfit
from app.services.weather import WeatherSnapshot
from tests.helpers import auth_headers, sample_image_bytes


class _FakeGarment:
    def __init__(self, id, category, warmth):
        self.id = id
        self.category = category
        self.warmth_rating = warmth
        self.colors = []
        self.seasons = []
        self.subcategory = None
        self.formality = None


def test_target_warmth_bands():
    assert _target_warmth(30) == 1
    assert _target_warmth(20) == 2
    assert _target_warmth(12) == 3
    assert _target_warmth(4) == 4
    assert _target_warmth(-5) == 5
    assert _target_warmth(None) == 3


def test_heuristic_picks_warm_layers_when_cold():
    garments = [
        _FakeGarment(1, "top", 2),
        _FakeGarment(2, "top", 5),
        _FakeGarment(3, "bottom", 4),
        _FakeGarment(4, "footwear", 3),
        _FakeGarment(5, "outerwear", 5),
    ]
    cold = WeatherSnapshot(temp_c=-2, feels_like_c=-5, condition="Snow",
                           description="light snow", wind_kph=10, humidity=80)
    result = heuristic_outfit(garments, cold)
    # target warmth 5: warmer top (id 2) preferred, outerwear included
    assert 2 in result.garment_ids
    assert 3 in result.garment_ids
    assert 5 in result.garment_ids  # outerwear when cold
    assert result.source == "heuristic"


def test_today_requires_non_empty_wardrobe(client: TestClient):
    headers = auth_headers(client)
    resp = client.get("/recommendations/today", headers=headers)
    assert resp.status_code == 400


def test_today_returns_outfit_from_wardrobe(client: TestClient):
    headers = auth_headers(client)
    # Upload two items and tag them so the heuristic can categorize.
    ids = []
    for color, category in [("white", "top"), ("blue", "bottom")]:
        item = client.post(
            "/wardrobe/items",
            headers=headers,
            files={"file": (f"{category}.png", sample_image_bytes(color), "image/png")},
        ).json()
        client.patch(
            f"/wardrobe/items/{item['id']}",
            headers=headers,
            json={"category": category, "warmth_rating": 3},
        )
        ids.append(item["id"])

    resp = client.get("/recommendations/today", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    returned_ids = {i["id"] for i in body["items"]}
    assert returned_ids.issubset(set(ids))
    assert len(body["items"]) >= 2
    assert body["source"] in ("ai", "heuristic")


def test_today_uses_client_supplied_date_over_server_date(client: TestClient):
    """A ?date= param overrides the server's own clock — this is the fix for
    events silently shifting a day for users in a different timezone than the
    server (the calendar-event date is always the caller's local date)."""
    headers = auth_headers(client)
    item = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("top.png", sample_image_bytes("white"), "image/png")},
    ).json()
    client.patch(
        f"/wardrobe/items/{item['id']}",
        headers=headers,
        json={"category": "top", "warmth_rating": 3},
    )

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    client.post(
        "/calendar/events",
        headers=headers,
        json={"title": "Client-local today", "date": tomorrow, "event_type": "formal"},
    )

    # Without a date param, the server's own today() doesn't see tomorrow's event.
    default_body = client.get("/recommendations/today", headers=headers).json()
    assert "Client-local today" not in default_body["rationale"]

    # With the client's local date explicitly supplied, it does.
    dated_body = client.get(
        f"/recommendations/today?date={tomorrow}", headers=headers
    ).json()
    assert "Client-local today" in dated_body["rationale"]
