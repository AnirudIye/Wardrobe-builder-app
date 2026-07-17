from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.core import lockout
from app.core.security import create_reset_token
from app.models.user import User


def _enabled_settings() -> Settings:
    return Settings(
        _env_file=None,
        rate_limit_enabled=True,
        login_lockout_attempts=3,
        login_lockout_minutes=15,
    )


@pytest.fixture(autouse=True)
def _fresh_lockout(monkeypatch):
    # Enable the lockout for these tests only (the suite-wide env disables
    # every abuse protection via RATE_LIMIT_ENABLED=false) and isolate state.
    monkeypatch.setattr("app.core.lockout.get_settings", _enabled_settings)
    lockout.reset()
    yield
    lockout.reset()


# --- Unit level ---


def test_locks_after_threshold():
    for _ in range(3):
        assert lockout.retry_after(1) == 0
        lockout.record_failure(1)
    assert lockout.retry_after(1) > 0


def test_success_clear_unlocks():
    for _ in range(3):
        lockout.record_failure(1)
    lockout.clear(1)
    assert lockout.retry_after(1) == 0


def test_window_expiry_unlocks(monkeypatch):
    t = {"now": 1000.0}
    monkeypatch.setattr("app.core.lockout.time.monotonic", lambda: t["now"])
    for _ in range(3):
        lockout.record_failure(1)
    assert lockout.retry_after(1) > 0
    t["now"] += 15 * 60 + 1
    assert lockout.retry_after(1) == 0


def test_users_are_independent():
    for _ in range(3):
        lockout.record_failure(1)
    assert lockout.retry_after(2) == 0


def test_disabled_is_noop(monkeypatch):
    monkeypatch.setattr(
        "app.core.lockout.get_settings",
        lambda: Settings(_env_file=None, rate_limit_enabled=False),
    )
    for _ in range(10):
        lockout.record_failure(1)
    assert lockout.retry_after(1) == 0


# --- Endpoint level ---


def test_login_locks_after_repeated_failures(client: TestClient):
    client.post("/auth/register", json={"email": "l@example.com", "password": "rightpass123"})
    for _ in range(3):
        r = client.post("/auth/login", data={"username": "l@example.com", "password": "wrongpass1"})
        assert r.status_code == 401

    # Even the correct password is refused while locked.
    r = client.post("/auth/login", data={"username": "l@example.com", "password": "rightpass123"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_unknown_email_never_locks(client: TestClient):
    for _ in range(5):
        r = client.post("/auth/login", data={"username": "ghost@example.com", "password": "x" * 10})
        assert r.status_code == 401  # still the generic 401, never 429


def test_successful_login_resets_counter(client: TestClient):
    client.post("/auth/register", json={"email": "ok@example.com", "password": "rightpass123"})
    for _ in range(2):  # one below the threshold of 3
        client.post("/auth/login", data={"username": "ok@example.com", "password": "wrongpass1"})
    assert (
        client.post(
            "/auth/login", data={"username": "ok@example.com", "password": "rightpass123"}
        ).status_code
        == 200
    )
    # Counter cleared: two more failures don't lock.
    for _ in range(2):
        client.post("/auth/login", data={"username": "ok@example.com", "password": "wrongpass1"})
    assert (
        client.post(
            "/auth/login", data={"username": "ok@example.com", "password": "rightpass123"}
        ).status_code
        == 200
    )


def test_password_reset_clears_lockout(client: TestClient, db_session):
    client.post("/auth/register", json={"email": "stuck@example.com", "password": "rightpass123"})
    for _ in range(3):
        client.post("/auth/login", data={"username": "stuck@example.com", "password": "wrongpass1"})
    assert (
        client.post(
            "/auth/login", data={"username": "stuck@example.com", "password": "rightpass123"}
        ).status_code
        == 429
    )

    # The emailed reset link is the recovery path: it proves inbox ownership,
    # so redeeming it unlocks the account immediately.
    user = db_session.execute(
        select(User).where(User.email == "stuck@example.com")
    ).scalar_one()
    token = create_reset_token(user.id, user.hashed_password)
    r = client.post("/auth/reset-password", json={"token": token, "password": "freshpass456"})
    assert r.status_code == 200
    assert (
        client.post(
            "/auth/login", data={"username": "stuck@example.com", "password": "freshpass456"}
        ).status_code
        == 200
    )
