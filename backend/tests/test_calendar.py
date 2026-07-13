from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.services.recommendation import dressiest_event, heuristic_outfit
from tests.helpers import auth_headers, sample_image_bytes


class _FakeEvent:
    def __init__(self, title, event_type):
        self.title = title
        self.event_type = event_type
        self.notes = None


class _FakeGarment:
    def __init__(self, id, category, warmth, formality):
        self.id = id
        self.category = category
        self.warmth_rating = warmth
        self.formality = formality
        self.colors = []
        self.seasons = []
        self.subcategory = None


def _create_event(client, headers, **overrides):
    payload = {
        "title": "Coffee with Sam",
        "date": date.today().isoformat(),
        "event_type": "casual",
    }
    payload.update(overrides)
    return client.post("/calendar/events", headers=headers, json=payload)


# --- unit: engine ---

def test_dressiest_event_picks_most_formal():
    events = [_FakeEvent("Gym", "athletic"), _FakeEvent("Wedding", "formal"), _FakeEvent("Lunch", "casual")]
    assert dressiest_event(events).title == "Wedding"


def test_heuristic_prefers_event_formality():
    garments = [
        _FakeGarment(1, "top", 3, "casual"),
        _FakeGarment(2, "top", 3, "formal"),
        _FakeGarment(3, "bottom", 3, "casual"),
        _FakeGarment(4, "bottom", 3, "formal"),
    ]
    result = heuristic_outfit(garments, None, events=[_FakeEvent("Gala", "formal")])
    assert 2 in result.garment_ids  # formal top over casual top
    assert 4 in result.garment_ids  # formal bottom over casual bottom
    assert "Gala" in result.rationale

    result_casual = heuristic_outfit(garments, None, events=[_FakeEvent("Picnic", "casual")])
    assert 1 in result_casual.garment_ids
    assert 3 in result_casual.garment_ids


# --- API: CRUD + isolation ---

def test_event_crud(client: TestClient):
    headers = auth_headers(client)
    resp = _create_event(client, headers, title="Interview", event_type="business")
    assert resp.status_code == 201, resp.text
    event_id = resp.json()["id"]

    events = client.get("/calendar/events", headers=headers).json()
    assert len(events) == 1
    assert events[0]["title"] == "Interview"

    resp = client.patch(
        f"/calendar/events/{event_id}", headers=headers, json={"event_type": "formal"}
    )
    assert resp.status_code == 200
    assert resp.json()["event_type"] == "formal"

    assert client.delete(f"/calendar/events/{event_id}", headers=headers).status_code == 204
    assert client.get("/calendar/events", headers=headers).json() == []


def test_event_rejects_bad_type(client: TestClient):
    headers = auth_headers(client)
    resp = _create_event(client, headers, event_type="black-tie-optional")
    assert resp.status_code == 422


def test_event_date_filters(client: TestClient):
    headers = auth_headers(client)
    _create_event(client, headers, title="Past", date=(date.today() - timedelta(days=10)).isoformat())
    _create_event(client, headers, title="Soon", date=(date.today() + timedelta(days=2)).isoformat())

    upcoming = client.get(
        f"/calendar/events?from={date.today().isoformat()}", headers=headers
    ).json()
    assert [e["title"] for e in upcoming] == ["Soon"]


def test_events_are_user_isolated(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    event_id = _create_event(client, a).json()["id"]

    assert client.get("/calendar/events", headers=b).json() == []
    assert client.patch(f"/calendar/events/{event_id}", headers=b, json={"title": "x"}).status_code == 404
    assert client.delete(f"/calendar/events/{event_id}", headers=b).status_code == 404


# --- integration: today's recommendation respects today's event ---

def test_today_recommendation_uses_todays_event(client: TestClient):
    headers = auth_headers(client)
    # Two tops: one casual, one formal; a neutral bottom.
    ids = {}
    for name, category, formality in [
        ("casual-top", "top", "casual"),
        ("formal-top", "top", "formal"),
        ("bottom", "bottom", "formal"),
    ]:
        item = client.post(
            "/wardrobe/items",
            headers=headers,
            files={"file": (f"{name}.png", sample_image_bytes(), "image/png")},
        ).json()
        client.patch(
            f"/wardrobe/items/{item['id']}",
            headers=headers,
            json={"category": category, "warmth_rating": 3, "formality": formality},
        )
        ids[name] = item["id"]

    _create_event(client, headers, title="Awards Night", event_type="formal")

    body = client.get("/recommendations/today", headers=headers).json()
    returned = {i["id"] for i in body["items"]}
    assert ids["formal-top"] in returned
    assert ids["casual-top"] not in returned
    assert "Awards Night" in body["rationale"]
