from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recommendation_event import RecommendationEvent
from app.models.user import User
from app.services import billing
from tests.helpers import auth_headers, sample_image_bytes


def _get_user(db: Session, email: str = "user@example.com") -> User:
    return db.execute(select(User).where(User.email == email)).scalar_one()


def _setup_wardrobe(client: TestClient, headers: dict) -> None:
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


def test_free_user_blocked_at_sixth_buy_next(client: TestClient):
    headers = auth_headers(client)
    _setup_wardrobe(client, headers)
    for i in range(5):
        assert client.get("/recommendations/buy-next", headers=headers).status_code == 200, i
    # 6th buy-next request in the window is blocked with HTTP 402.
    assert client.get("/recommendations/buy-next", headers=headers).status_code == 402


def test_today_is_never_paywalled(client: TestClient):
    """Today outfits are free and unlimited, even after buy-next quota is spent."""
    headers = auth_headers(client)
    _setup_wardrobe(client, headers)
    for _ in range(5):
        assert client.get("/recommendations/buy-next", headers=headers).status_code == 200
    assert client.get("/recommendations/buy-next", headers=headers).status_code == 402
    # Today keeps working well past the old 5/week limit.
    for i in range(7):
        assert client.get("/recommendations/today", headers=headers).status_code == 200, i


def test_paid_user_is_unlimited(client: TestClient, db_session: Session):
    headers = auth_headers(client)
    _setup_wardrobe(client, headers)
    user = _get_user(db_session)
    user.plan = "paid"
    db_session.commit()

    for i in range(8):
        assert client.get("/recommendations/buy-next", headers=headers).status_code == 200, i


def test_old_events_do_not_count(client: TestClient, db_session: Session):
    headers = auth_headers(client)
    _setup_wardrobe(client, headers)
    user = _get_user(db_session)
    # Five events from 8 days ago — outside the 7-day window.
    old = datetime.now(timezone.utc) - timedelta(days=8)
    for _ in range(5):
        db_session.add(RecommendationEvent(user_id=user.id, kind="buy-next", created_at=old))
    db_session.commit()

    # Still allowed, because the window only counts the last 7 days.
    assert client.get("/recommendations/buy-next", headers=headers).status_code == 200


def test_today_events_do_not_count_against_quota(client: TestClient, db_session: Session):
    headers = auth_headers(client)
    _setup_wardrobe(client, headers)
    user = _get_user(db_session)
    # Plenty of recent "today" usage — must not affect the buy-next allowance.
    for _ in range(10):
        db_session.add(RecommendationEvent(user_id=user.id, kind="today"))
    db_session.commit()

    assert client.get("/recommendations/buy-next", headers=headers).status_code == 200


def test_billing_status_reports_remaining(client: TestClient):
    headers = auth_headers(client)
    resp = client.get("/billing/status", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan"] == "free"
    assert body["weekly_limit"] == 5
    assert body["remaining_this_week"] == 5


def test_webhook_apply_flips_free_to_paid_and_back(client: TestClient, db_session: Session):
    headers = auth_headers(client)  # ensures a user exists
    user = _get_user(db_session)

    subscribe_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "status": "active",
                "client_reference_id": str(user.id),
                "current_period_end": 1893456000,
            }
        },
    }
    billing.apply_subscription_event(db_session, subscribe_event)
    db_session.refresh(user)
    assert user.plan == "paid"
    assert user.subscription_status == "active"

    cancel_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"status": "canceled", "client_reference_id": str(user.id)}},
    }
    billing.apply_subscription_event(db_session, cancel_event)
    db_session.refresh(user)
    assert user.plan == "free"


def test_paid_status_shows_unlimited(client: TestClient, db_session: Session):
    headers = auth_headers(client)
    user = _get_user(db_session)
    user.plan = "paid"
    user.subscription_status = "active"
    db_session.commit()

    body = client.get("/billing/status", headers=headers).json()
    assert body["plan"] == "paid"
    assert body["remaining_this_week"] is None  # unlimited
