from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    """Create a signed JWT whose `sub` claim is the user id (as a string)."""
    minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[str]:
    """Return the `sub` (user id) from a valid token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    return payload.get("sub")


def create_email_token(user_id: int) -> str:
    """Signed, short-lived token proving ownership of an email address."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.email_verify_expire_minutes
    )
    payload = {"sub": str(user_id), "purpose": "verify_email", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_email_token(token: str) -> Optional[int]:
    """Return the user id from a valid verify-email token, else None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("purpose") != "verify_email":
        return None
    sub = payload.get("sub")
    return int(sub) if sub is not None else None


def password_fingerprint(hashed_password: str) -> str:
    """Short digest of a password hash, embedded in reset tokens.

    Changing the password changes the fingerprint, which is what makes a reset
    token single-use without any server-side token storage.
    """
    return hashlib.sha256(hashed_password.encode()).hexdigest()[:16]


def create_reset_token(user_id: int, hashed_password: str) -> str:
    """Signed, short-lived token authorizing a password reset."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.password_reset_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "purpose": "reset_password",
        "pw": password_fingerprint(hashed_password),
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_reset_token(token: str) -> Optional[Tuple[int, str]]:
    """Return (user id, password fingerprint) from a valid reset token, else None.

    The caller must still compare the fingerprint against the user's current
    hash - a mismatch means the password already changed and the token is dead.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("purpose") != "reset_password":
        return None
    sub = payload.get("sub")
    fingerprint = payload.get("pw")
    if sub is None or fingerprint is None:
        return None
    return int(sub), fingerprint
