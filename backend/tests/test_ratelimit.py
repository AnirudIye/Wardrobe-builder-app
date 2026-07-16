from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.core import ratelimit


class _StubClient:
    host = "203.0.113.7"


class _StubRequest:
    client = _StubClient()


@pytest.fixture(autouse=True)
def _fresh_limiter(monkeypatch):
    # Enable limiting for these tests only (the suite-wide env disables it),
    # and isolate counters between tests.
    monkeypatch.setattr(
        "app.core.ratelimit.get_settings",
        lambda: Settings(_env_file=None, rate_limit_enabled=True),
    )
    ratelimit.reset()
    yield
    ratelimit.reset()


def test_allows_up_to_limit_then_429():
    dep = ratelimit.rate_limit("t", times=3, seconds=60)
    for _ in range(3):
        dep(_StubRequest())
    with pytest.raises(HTTPException) as exc_info:
        dep(_StubRequest())
    assert exc_info.value.status_code == 429
    assert int(exc_info.value.headers["Retry-After"]) >= 1


def test_scopes_are_independent():
    a = ratelimit.rate_limit("a", times=1, seconds=60)
    b = ratelimit.rate_limit("b", times=1, seconds=60)
    a(_StubRequest())
    b(_StubRequest())  # different scope, same IP — allowed
    with pytest.raises(HTTPException):
        a(_StubRequest())


def test_window_expiry_frees_slots(monkeypatch):
    dep = ratelimit.rate_limit("w", times=1, seconds=60)
    t = {"now": 1000.0}
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", lambda: t["now"])
    dep(_StubRequest())
    with pytest.raises(HTTPException):
        dep(_StubRequest())
    t["now"] += 61  # window rolls past the first hit
    dep(_StubRequest())  # allowed again


def test_disabled_limiter_is_noop(monkeypatch):
    monkeypatch.setattr(
        "app.core.ratelimit.get_settings",
        lambda: Settings(_env_file=None, rate_limit_enabled=False),
    )
    dep = ratelimit.rate_limit("off", times=1, seconds=60)
    for _ in range(10):
        dep(_StubRequest())  # never raises
