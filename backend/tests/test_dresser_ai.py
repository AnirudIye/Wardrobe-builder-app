from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services import dresser_ai
from tests.helpers import auth_headers


def _chat(client: TestClient, headers: dict, text: str = "What should I wear?"):
    return client.post(
        "/dresser-ai/chat",
        headers=headers,
        json={"messages": [{"role": "user", "content": text}]},
    )


def test_chat_requires_auth(client: TestClient):
    resp = client.post("/dresser-ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401


def test_chat_rejects_empty_messages(client: TestClient):
    headers = auth_headers(client)
    resp = client.post("/dresser-ai/chat", headers=headers, json={"messages": []})
    assert resp.status_code == 422


def test_chat_without_key_returns_friendly_fallback(client: TestClient):
    # No ANTHROPIC_API_KEY configured in the test environment (conftest blanks it) —
    # the endpoint must still succeed with a friendly message, never a hard failure.
    headers = auth_headers(client)
    resp = _chat(client, headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["reply"] == dresser_ai.FALLBACK_REPLY


def test_chat_uses_mocked_reply(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        dresser_ai, "chat_reply", lambda **kwargs: "Try your navy blazer with white sneakers."
    )
    headers = auth_headers(client)
    resp = _chat(client, headers)
    assert resp.status_code == 200, resp.text
    assert "navy blazer" in resp.json()["reply"]


def test_chat_passes_full_transcript_through(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    captured = {}

    def fake_chat_reply(messages, **kwargs):
        captured["messages"] = messages
        return "ok"

    monkeypatch.setattr(dresser_ai, "chat_reply", fake_chat_reply)
    headers = auth_headers(client)
    resp = client.post(
        "/dresser-ai/chat",
        headers=headers,
        json={
            "messages": [
                {"role": "user", "content": "What goes with jeans?"},
                {"role": "assistant", "content": "A plain white tee works well."},
                {"role": "user", "content": "What about shoes?"},
            ]
        },
    )
    assert resp.status_code == 200
    assert len(captured["messages"]) == 3
    assert captured["messages"][-1] == {"role": "user", "content": "What about shoes?"}


def test_chat_has_its_own_quota_independent_of_buy_next(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(dresser_ai, "chat_reply", lambda **kwargs: "reply")
    headers = auth_headers(client)

    # Exhaust the free chat quota (default 20/week).
    for i in range(20):
        assert _chat(client, headers, f"question {i}").status_code == 200, i
    assert _chat(client, headers, "one more").status_code == 402

    # Buy-next's own quota is untouched by chat usage.
    resp = client.get("/recommendations/buy-next", headers=headers)
    assert resp.status_code == 200

    status_resp = client.get("/billing/status", headers=headers).json()
    assert status_resp["chat_remaining_this_week"] == 0
    assert status_resp["remaining_today"] == 4  # one buy-next call consumed above
