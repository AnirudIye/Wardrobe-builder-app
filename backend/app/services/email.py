from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)

# Best-effort transactional email over stdlib SMTP. Like services/llm.py it
# never raises to the caller: when SMTP isn't configured or a send fails, it
# logs and returns False so signup still works with zero secrets.


def _real(value: str) -> str:
    """Treat blank / obvious placeholder values as unset."""
    v = (value or "").strip()
    if not v or "..." in v or "change-me" in v.lower() or v.lower().startswith("your"):
        return ""
    return v


def available() -> bool:
    s = get_settings()
    return bool(_real(s.smtp_host) and _real(s.smtp_from))


def send(to: str, subject: str, html: str, text: str) -> bool:
    """Send one email. Returns True on success, False on any failure/misconfig."""
    s = get_settings()
    if not available():
        logger.info("Email not configured; skipping send to %s (subject=%r)", to, subject)
        return False

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
    except Exception as exc:  # best-effort — never propagate (see llm.py)
        logger.warning("SMTP send to %s failed: %s", to, exc)
        return False


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
