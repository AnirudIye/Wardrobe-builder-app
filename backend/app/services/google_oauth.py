from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)

# "Sign in with Google" verification. The SPA renders Google's button (Google
# Identity Services), which hands it a signed ID token; this module checks the
# signature, audience, expiry, and issuer against our OAuth client id. Best-
# effort like every integration: unconfigured or invalid input means None /
# unavailable, never an exception to the caller. google-auth ships with the
# genai SDK, so this costs no new dependency.


def _real(value: str) -> str:
    """Treat blank / obvious placeholder values as unset."""
    v = (value or "").strip()
    if not v or "..." in v or "change-me" in v.lower() or v.lower().startswith("your"):
        return ""
    return v


class GoogleIdentity(BaseModel):
    email: str
    email_verified: bool


def client_id() -> Optional[str]:
    return _real(get_settings().google_oauth_client_id) or None


def available() -> bool:
    return client_id() is not None


def verify(credential: str) -> Optional[GoogleIdentity]:
    """Verify a Google ID token; return the identity, or None on any failure."""
    cid = client_id()
    if not cid:
        return None
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), cid
        )
        email = (info.get("email") or "").strip().lower()
        if not email:
            return None
        return GoogleIdentity(email=email, email_verified=bool(info.get("email_verified")))
    except Exception as exc:  # bad/expired/foreign token, network failure
        logger.warning("Google sign-in verification failed: %s", exc)
        return None
