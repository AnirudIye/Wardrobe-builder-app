from __future__ import annotations

import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core import lockout
from app.core.deps import get_current_user
from app.core.ratelimit import rate_limit
from app.core.security import (
    create_access_token,
    create_email_token,
    create_reset_token,
    decode_email_token,
    decode_reset_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleSignInRequest,
    ResendRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserOut,
    VerifyRequest,
)
from app.services import email, google_oauth

router = APIRouter(prefix="/auth", tags=["auth"])


def _canonical_email(address: str) -> str:
    # Mailboxes are case-insensitive in practice, so emails are stored and
    # compared lowercase - otherwise Foo@x.com could open a second account
    # alongside foo@x.com. Every lookup and every account creation must go
    # through this.
    return address.strip().lower()


def _get_user_by_email(db: Session, address: str) -> User | None:
    return db.execute(
        select(User).where(User.email == _canonical_email(address))
    ).scalar_one_or_none()


def _verification_link(token: str) -> str:
    base = get_settings().frontend_base_url.rstrip("/")
    return f"{base}/?verify_token={token}"


def _reset_link(token: str) -> str:
    base = get_settings().frontend_base_url.rstrip("/")
    return f"{base}/?reset_token={token}"


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("register", 20, 3600))],
)
def register(
    payload: UserCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> User:
    if _get_user_by_email(db, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    # With no email service configured, verify immediately so the app still
    # works with zero secrets (mirrors every other best-effort integration).
    verified = not email.available()
    user = User(
        email=_canonical_email(payload.email),
        hashed_password=hash_password(payload.password),
        email_verified=verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    if not verified:
        link = _verification_link(create_email_token(user.id))
        background.add_task(email.send_verification_email, user.email, link)
    return user


@router.post("/login", response_model=Token, dependencies=[Depends(rate_limit("login", 10, 60))])
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2 spec uses `username`; we treat it as the email.
    user = _get_user_by_email(db, form_data.username)
    if user is not None:
        retry = lockout.retry_after(user.id)
        if retry:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please try again shortly.",
                headers={"Retry-After": str(retry)},
            )
    if user is None or not verify_password(form_data.password, user.hashed_password):
        if user is not None:
            lockout.record_failure(user.id)
        # One generic message for both halves - login never reveals whether
        # an account exists (anti-enumeration).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    lockout.clear(user.id)
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your email address before signing in.",
        )
    return Token(access_token=create_access_token(subject=user.id))


@router.post("/verify", response_model=Token, dependencies=[Depends(rate_limit("verify", 30, 60))])
def verify_email(payload: VerifyRequest, db: Session = Depends(get_db)) -> Token:
    user_id = decode_email_token(payload.token)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )
    user.email_verified = True
    db.commit()
    return Token(access_token=create_access_token(subject=user.id))


@router.post(
    "/resend-verification",
    # Tightest limit: this endpoint sends real email.
    dependencies=[Depends(rate_limit("resend", 5, 3600))],
)
def resend_verification(
    payload: ResendRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_by_email(db, payload.email)
    if user is not None and not user.email_verified and email.available():
        link = _verification_link(create_email_token(user.id))
        background.add_task(email.send_verification_email, user.email, link)
    # Always generic - never reveal whether an account exists.
    return {"detail": "If that account exists and is unverified, a confirmation email has been sent."}


@router.post(
    "/forgot-password",
    # Tight limit: this endpoint sends real email (same tier as resend).
    dependencies=[Depends(rate_limit("forgot", 5, 3600))],
)
def forgot_password(
    payload: ForgotPasswordRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_by_email(db, payload.email)
    if user is not None and email.available():
        link = _reset_link(create_reset_token(user.id, user.hashed_password))
        background.add_task(email.send_password_reset_email, user.email, link)
    # Always generic - never reveal whether an account exists.
    return {"detail": "If that account exists, a password reset email has been sent."}


@router.post(
    "/reset-password",
    response_model=Token,
    dependencies=[Depends(rate_limit("reset", 10, 60))],
)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> Token:
    decoded = decode_reset_token(payload.token)
    user = db.get(User, decoded[0]) if decoded is not None else None
    # The fingerprint pins the token to the hash it was issued against, so a
    # token dies the moment the password changes (single-use, no storage).
    if user is None or decoded[1] != password_fingerprint(user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )
    user.hashed_password = hash_password(payload.password)
    # Redeeming a link mailed to the address proves inbox ownership - the same
    # property email verification certifies. It is also the recovery path out
    # of a login lockout.
    user.email_verified = True
    db.commit()
    lockout.clear(user.id)
    return Token(access_token=create_access_token(subject=user.id))


@router.get("/google/config")
def google_config() -> dict:
    # Public: the SPA needs the client id to render Google's button. Null when
    # Google sign-in isn't configured, and the SPA hides the button.
    return {"client_id": google_oauth.client_id()}


@router.post(
    "/google",
    response_model=Token,
    dependencies=[Depends(rate_limit("google", 10, 60))],
)
def google_sign_in(payload: GoogleSignInRequest, db: Session = Depends(get_db)) -> Token:
    """Sign in (creating the account on first use) with a Google ID token."""
    if not google_oauth.available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in isn't available right now",
        )
    identity = google_oauth.verify(payload.credential)
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in failed. Please try again.",
        )
    if not identity.email_verified:
        # Linking on email requires Google to have verified it, else someone
        # could claim an unowned address and inherit a local account.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This Google account's email address is unverified.",
        )
    user = _get_user_by_email(db, identity.email)
    if user is None:
        # First Google sign-in creates the account. The random placeholder
        # password is unguessable; setting a real one later works through the
        # normal forgot-password flow.
        user = User(
            email=_canonical_email(identity.email),
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            email_verified=True,
        )
        db.add(user)
    else:
        # Google vouches for the address, which is exactly what our own email
        # confirmation certifies.
        user.email_verified = True
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(subject=user.id))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
