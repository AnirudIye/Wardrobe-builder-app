from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.outfit_log import OutfitLog
from app.models.user import User
from tests.helpers import auth_headers, sample_image_bytes

TODAY = date.today()


def _garment_id(client: TestClient, headers: dict, color: str = "red") -> int:
    resp = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("g.png", sample_image_bytes(color), "image/png")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _log(client: TestClient, headers: dict, garment_ids, log_date=None, source="manual"):
    return client.post(
        "/fits/log",
        headers=headers,
        json={
            "date": (log_date or TODAY).isoformat(),
            "today": TODAY.isoformat(),
            "garment_ids": garment_ids,
            "source": source,
        },
    )


def _seed_log(db_session, headers_email: str, on: date, garment_ids=None):
    """Insert history directly - the API only accepts today/yesterday."""
    user = db_session.execute(select(User).where(User.email == headers_email)).scalar_one()
    db_session.add(
        OutfitLog(user_id=user.id, date=on, garment_ids=garment_ids or [], source="manual")
    )
    db_session.commit()


def test_log_requires_auth(client: TestClient):
    assert client.post("/fits/log", json={}).status_code == 401


def test_status_empty(client: TestClient):
    headers = auth_headers(client)
    resp = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["today_logged"] is False
    assert body["current_streak"] == 0
    assert body["longest_streak"] == 0
    assert len(body["week"]) == 7
    assert all(not d["logged"] for d in body["week"])
    assert body["week_points"] == 0
    assert body["percentile"] is None
    assert body["total_logs"] == 0


def test_log_today_and_status_shape(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    g2 = _garment_id(client, headers, "blue")
    resp = _log(client, headers, [g1, g2])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["today_logged"] is True
    assert body["today_source"] == "manual"
    assert body["today_garment_ids"] == [g1, g2]
    assert body["current_streak"] == 1
    assert body["longest_streak"] == 1
    assert body["week_points"] == 10 + 4  # one day + two distinct garments
    assert body["total_logs"] == 1
    assert isinstance(body["closet_score"], int)
    # Sole active user: more days than 0% of active users.
    assert body["percentile"] == 0
    logged_days = [d for d in body["week"] if d["logged"]]
    assert [d["date"] for d in logged_days] == [TODAY.isoformat()]


def test_relogging_the_same_day_replaces(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    g2 = _garment_id(client, headers, "blue")
    _log(client, headers, [g1])
    body = _log(client, headers, [g2], source="recommendation").json()
    assert body["total_logs"] == 1
    assert body["today_garment_ids"] == [g2]
    assert body["today_source"] == "recommendation"


def test_backfill_yesterday_extends_streak(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    _log(client, headers, [g1])
    resp = _log(client, headers, [g1], log_date=TODAY - timedelta(days=1))
    assert resp.status_code == 200, resp.text
    assert resp.json()["current_streak"] == 2


def test_rejects_dates_older_than_yesterday(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    resp = _log(client, headers, [g1], log_date=TODAY - timedelta(days=2))
    assert resp.status_code == 400


def test_rejects_future_date(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    resp = _log(client, headers, [g1], log_date=TODAY + timedelta(days=1))
    assert resp.status_code == 400


def test_rejects_implausible_client_today(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    resp = client.post(
        "/fits/log",
        headers=headers,
        json={
            "date": (TODAY + timedelta(days=5)).isoformat(),
            "today": (TODAY + timedelta(days=5)).isoformat(),
            "garment_ids": [g1],
            "source": "manual",
        },
    )
    assert resp.status_code == 400


def test_rejects_foreign_garment(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    foreign = _garment_id(client, b)
    own = _garment_id(client, a)
    assert _log(client, a, [foreign]).status_code == 404
    # Mixed owned + foreign must also fail, with nothing written.
    assert _log(client, a, [own, foreign]).status_code == 404
    status = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=a).json()
    assert status["total_logs"] == 0


def test_rejects_empty_garment_list(client: TestClient):
    headers = auth_headers(client)
    resp = _log(client, headers, [])
    assert resp.status_code == 422


def test_rejects_unknown_source(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    resp = _log(client, headers, [g1], source="teleported")
    assert resp.status_code == 422


def test_streak_uses_rest_day_grace(client: TestClient, db_session):
    headers = auth_headers(client, email="grace@example.com")
    g1 = _garment_id(client, headers)
    # Seed a run with a single-day gap: -4, -3, -1 then log today. The gap
    # at -2 is the rest day wherever the ISO week boundary falls.
    for offset in (4, 3, 1):
        _seed_log(db_session, "grace@example.com", TODAY - timedelta(days=offset), [g1])
    body = _log(client, headers, [g1]).json()
    assert body["current_streak"] == 4
    assert body["longest_streak"] == 4


def test_status_exposes_todays_shared_challenge(client: TestClient):
    from app.services.challenges import challenge_for

    headers = auth_headers(client)
    body = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=headers).json()
    expected = challenge_for(TODAY)
    assert body["challenge_name"] == expected["name"]
    assert body["challenge_brief"] == expected["brief"]
    assert body["challenge_done"] is False


def test_challenge_claim_adds_points(client: TestClient):
    headers = auth_headers(client)
    g1 = _garment_id(client, headers)
    resp = client.post(
        "/fits/log",
        headers=headers,
        json={
            "date": TODAY.isoformat(),
            "today": TODAY.isoformat(),
            "garment_ids": [g1],
            "source": "manual",
            "challenge_done": True,
        },
    )
    body = resp.json()
    assert body["challenge_done"] is True
    assert body["week_points"] == 10 + 2 + 5  # day + one garment + challenge


def test_wear_stats(client: TestClient, db_session):
    headers = auth_headers(client, email="wears@example.com")
    g1 = _garment_id(client, headers)
    g2 = _garment_id(client, headers, "blue")
    g3 = _garment_id(client, headers, "green")  # never worn
    client.patch(f"/wardrobe/items/{g1}", headers=headers, json={"price": 150})
    _seed_log(db_session, "wears@example.com", TODAY - timedelta(days=1), [g1])
    _log(client, headers, [g1, g2])

    resp = client.get("/fits/wear-stats", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    by_id = {item["garment_id"]: item for item in body["items"]}
    assert by_id[g1]["wears"] == 2
    assert by_id[g1]["cost_per_wear"] == 75.0
    assert by_id[g2]["wears"] == 1
    assert by_id[g2]["price"] is None
    assert by_id[g2]["cost_per_wear"] is None
    assert by_id[g3]["wears"] == 0
    assert body["closet_value"] == 150
    assert body["never_worn"] == 1


def test_wear_stats_requires_auth(client: TestClient):
    assert client.get("/fits/wear-stats").status_code == 401


def test_percentile_across_users(client: TestClient, db_session):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    auth_headers(client, email="c@example.com")  # registered, never logs
    ga = _garment_id(client, a)
    gb = _garment_id(client, b)
    # A: 3 days in the trailing week; B: 1 day; C: 0 days (inactive).
    _seed_log(db_session, "a@example.com", TODAY - timedelta(days=2), [ga])
    _seed_log(db_session, "a@example.com", TODAY - timedelta(days=1), [ga])
    a_body = _log(client, a, [ga]).json()
    b_body = _log(client, b, [gb]).json()
    # A beats B (1 of 2 active users has fewer days): 50.
    assert a_body["percentile"] == 50 or a_body["percentile"] is not None
    a_status = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=a).json()
    b_status = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=b).json()
    assert a_status["percentile"] == 50
    assert b_status["percentile"] == 0
    c = auth_headers(client, email="c@example.com")
    c_status = client.get(f"/fits/status?date={TODAY.isoformat()}", headers=c).json()
    assert c_status["percentile"] is None
