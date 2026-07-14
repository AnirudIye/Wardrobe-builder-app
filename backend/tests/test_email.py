from __future__ import annotations

from app.services import email


def test_email_unavailable_without_config():
    assert email.available() is False


def test_send_returns_false_when_unconfigured():
    assert email.send("x@example.com", "Hi", "<b>hi</b>", "hi") is False


def test_send_verification_email_noops_without_config():
    assert email.send_verification_email("x@example.com", "http://x/?verify_token=abc") is False
