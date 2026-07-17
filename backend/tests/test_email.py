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
    # escape send() — best-effort contract: log and return False, never raise.
    configured = Settings(smtp_host="smtp.example.com", smtp_from="a@example.com")
    monkeypatch.setattr(email, "get_settings", lambda: configured)
    assert email.send("x@example.com", "Hi\nInjected: yes", "<b>hi</b>", "hi") is False
