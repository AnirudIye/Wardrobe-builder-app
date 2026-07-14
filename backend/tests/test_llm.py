from __future__ import annotations

import pytest

from app.config import get_settings
from app.services import llm


def test_unavailable_without_any_key():
    # conftest blanks both ANTHROPIC_API_KEY and GOOGLE_API_KEY.
    assert llm.available() is False
    assert llm.complete(prompt="hello") is None


def _fresh_settings(monkeypatch: pytest.MonkeyPatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()


def test_available_with_google_key_only(monkeypatch: pytest.MonkeyPatch):
    _fresh_settings(monkeypatch, GOOGLE_API_KEY="test-google-key")
    try:
        assert llm.available() is True
    finally:
        get_settings.cache_clear()


def test_prefers_anthropic_when_both_keys(monkeypatch: pytest.MonkeyPatch):
    _fresh_settings(
        monkeypatch, ANTHROPIC_API_KEY="test-ant-key", GOOGLE_API_KEY="test-google-key"
    )
    calls = []
    monkeypatch.setattr(
        llm, "_anthropic_complete", lambda *a: calls.append("anthropic") or "ant-reply"
    )
    monkeypatch.setattr(
        llm, "_gemini_complete", lambda *a: calls.append("gemini") or "gem-reply"
    )
    try:
        assert llm.complete(prompt="hi") == "ant-reply"
        assert calls == ["anthropic"]
    finally:
        get_settings.cache_clear()


def test_routes_to_gemini_with_google_key_only(monkeypatch: pytest.MonkeyPatch):
    _fresh_settings(monkeypatch, GOOGLE_API_KEY="test-google-key")
    monkeypatch.setattr(llm, "_gemini_complete", lambda *a: "gem-reply")
    try:
        assert llm.complete(prompt="hi") == "gem-reply"
    finally:
        get_settings.cache_clear()
