from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Best-effort transactional email. Like services/llm.py it never raises to
# the caller: when nothing is configured or a send fails, it logs and returns
# False so signup still works with zero secrets. Two providers: the Brevo
# HTTP API is preferred when its key is set (some hosts - Render's free tier -
# block outbound SMTP entirely, [Errno 101]), else stdlib SMTP.


def _real(value: str) -> str:
    """Treat blank / obvious placeholder values as unset."""
    v = (value or "").strip()
    if not v or "..." in v or "change-me" in v.lower() or v.lower().startswith("your"):
        return ""
    return v


def _brevo_configured() -> bool:
    s = get_settings()
    return bool(_real(s.brevo_api_key) and _real(s.smtp_from))


def available() -> bool:
    s = get_settings()
    return _brevo_configured() or bool(_real(s.smtp_host) and _real(s.smtp_from))


def _send_brevo(to: str, subject: str, html: str, text: str) -> bool:
    s = get_settings()
    try:
        resp = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": _real(s.brevo_api_key)},
            json={
                # SMTP_FROM doubles as the Brevo verified sender.
                "sender": {"email": s.smtp_from},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html,
                "textContent": text,
            },
            timeout=15.0,
        )
        if resp.status_code >= 400:
            logger.warning("Brevo send to %s failed: HTTP %s %s", to, resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as exc:  # best-effort - never propagate (see llm.py)
        logger.warning("Brevo send to %s failed: %s", to, exc)
        return False


def send(to: str, subject: str, html: str, text: str) -> bool:
    """Send one email. Returns True on success, False on any failure/misconfig."""
    s = get_settings()
    if not available():
        logger.info("Email not configured; skipping send to %s (subject=%r)", to, subject)
        return False
    if _brevo_configured():
        return _send_brevo(to, subject, html, text)

    try:
        msg = EmailMessage()
        msg["From"] = s.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")

        if s.smtp_port == 465:
            server: smtplib.SMTP = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
        with server:
            if s.smtp_starttls and s.smtp_port != 465:
                server.starttls()
            if _real(s.smtp_user):
                server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
        return True
    except Exception as exc:  # best-effort - never propagate (see llm.py)
        logger.warning("SMTP send to %s failed: %s", to, exc)
        return False


def send_password_reset_email(to: str, link: str) -> bool:
    subject = "Reset your BetterDresser password"
    text = (
        "Someone asked to reset the password for your BetterDresser account.\n\n"
        f"Set a new password here (the link expires in an hour):\n{link}\n\n"
        "If this wasn't you, ignore this email and your password stays the same."
    )
    html = (
        '<div style="font-family:sans-serif;line-height:1.5;color:#0B1957">'
        "<h2>Reset your password</h2>"
        "<p>Someone asked to reset the password for your BetterDresser account. "
        "The link expires in an hour.</p>"
        f'<p><a href="{link}" style="background:#0B1957;color:#fff;padding:10px 18px;'
        'border-radius:12px;text-decoration:none">Set a new password</a></p>'
        f'<p style="color:#666;font-size:12px">Or paste this link into your browser:<br>{link}</p>'
        '<p style="color:#666;font-size:12px">If this wasn\'t you, ignore this email and '
        "your password stays the same.</p>"
        "</div>"
    )
    return send(to, subject, html, text)


def send_verification_email(to: str, link: str) -> bool:
    subject = "Confirm your BetterDresser account"
    text = (
        "Welcome to BetterDresser!\n\n"
        f"Confirm your email to start building your wardrobe:\n{link}\n\n"
        "If you didn't create this account, you can ignore this email."
    )
    html = (
        '<div style="font-family:sans-serif;line-height:1.5;color:#0B1957">'
        "<h2>Welcome to BetterDresser</h2>"
        "<p>Confirm your email to start building your wardrobe.</p>"
        f'<p><a href="{link}" style="background:#0B1957;color:#fff;padding:10px 18px;'
        'border-radius:12px;text-decoration:none">Confirm my email</a></p>'
        f'<p style="color:#666;font-size:12px">Or paste this link into your browser:<br>{link}</p>'
        "</div>"
    )
    return send(to, subject, html, text)
