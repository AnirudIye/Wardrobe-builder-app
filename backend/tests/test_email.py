from __future__ import annotations

from app.config import Settings
from app.services import email


def test_email_unavailable_without_config():
    assert email.available() is False


def test_send_returns_false_when_unconfigured():
    assert email.send("x@example.com", "Hi", "<b>hi</b>", "hi") is False


def test_send_verification_email_noops_without_config():
    assert email.send_verification_email("x@example.com", "http://x/?verify_token=abc") is False


def test_send_password_reset_email_noops_without_config():
    assert email.send_password_reset_email("x@example.com", "http://x/?reset_token=abc") is False


def test_send_swallows_malformed_headers(monkeypatch):
    # Even when SMTP is "configured", a header with an embedded newline must not
    # escape send() - best-effort contract: log and return False, never raise.
    configured = Settings(smtp_host="smtp.example.com", smtp_from="a@example.com")
    monkeypatch.setattr(email, "get_settings", lambda: configured)
    assert email.send("x@example.com", "Hi\nInjected: yes", "<b>hi</b>", "hi") is False


# --- Brevo HTTP API provider (hosts like Render free tier block SMTP) ---


class _Resp:
    def __init__(self, status_code: int):
        self.status_code = status_code
        self.text = "brevo says no" if status_code >= 400 else "created"


def _brevo_settings(monkeypatch, **overrides):
    settings = Settings(brevo_api_key="xkeysib-abc123", smtp_from="sender@example.com", **overrides)
    monkeypatch.setattr(email, "get_settings", lambda: settings)
    return settings


def test_brevo_key_alone_makes_email_available(monkeypatch):
    _brevo_settings(monkeypatch)
    assert email.available() is True


def test_brevo_send_posts_the_right_payload(monkeypatch):
    _brevo_settings(monkeypatch)
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured.update(url=url, headers=headers, json=json)
        return _Resp(201)

    monkeypatch.setattr(email.httpx, "post", fake_post)
    assert email.send("to@example.com", "Hello", "<b>html</b>", "plain") is True
    assert captured["url"] == "https://api.brevo.com/v3/smtp/email"
    assert captured["headers"]["api-key"] == "xkeysib-abc123"
    assert captured["json"]["sender"] == {"email": "sender@example.com"}
    assert captured["json"]["to"] == [{"email": "to@example.com"}]
    assert captured["json"]["subject"] == "Hello"
    assert captured["json"]["htmlContent"] == "<b>html</b>"
    assert captured["json"]["textContent"] == "plain"


def test_brevo_error_status_returns_false(monkeypatch):
    _brevo_settings(monkeypatch)
    monkeypatch.setattr(email.httpx, "post", lambda *a, **k: _Resp(401))
    assert email.send("to@example.com", "s", "h", "t") is False


def test_brevo_network_error_returns_false(monkeypatch):
    _brevo_settings(monkeypatch)

    def boom(*a, **k):
        raise email.httpx.ConnectError("no route")

    monkeypatch.setattr(email.httpx, "post", boom)
    assert email.send("to@example.com", "s", "h", "t") is False


def test_brevo_preferred_over_smtp_when_both_configured(monkeypatch):
    _brevo_settings(monkeypatch, smtp_host="smtp.example.com")
    monkeypatch.setattr(email.httpx, "post", lambda *a, **k: _Resp(201))

    def smtp_should_not_run(*a, **k):
        raise AssertionError("SMTP path must not run when Brevo is configured")

    monkeypatch.setattr(email.smtplib, "SMTP", smtp_should_not_run)
    assert email.send("to@example.com", "s", "h", "t") is True


def test_placeholder_brevo_key_is_ignored(monkeypatch):
    settings = Settings(brevo_api_key="your-brevo-key-here", smtp_from="a@example.com")
    monkeypatch.setattr(email, "get_settings", lambda: settings)
    assert email.available() is False
