# Account, Email Confirmation, Cursor & Delete-Confirmation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verify-before-use email confirmation, a blob-only cursor, a reusable delete-confirmation modal, and an account avatar/dropdown (settings, style-preferences customization, account deletion) to BetterDresser.

**Architecture:** Backend stays FastAPI thin-router → service-layer. Email goes through a new best-effort `services/email.py` gateway (stdlib `smtplib`) mirroring `services/llm.py`; verification uses a stateless signed JWT (a `purpose` claim on top of the existing `jose` usage) plus one `email_verified` flag. Account features add an `avatar_key` column served through the existing `StorageBackend`, plus password-change and hard-delete endpoints. Frontend is the existing router-less React SPA (tab state in `App.tsx`), extended with modals and one CSS media query.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (SQLite dev), Pydantic v2, `jose`, `passlib[bcrypt]`, Pillow, stdlib `smtplib`; React 18 + Vite + TypeScript + Tailwind.

## Global Constraints

- **Python 3.9** - every new module starts with `from __future__ import annotations`; no PEP-604 runtime unions outside annotations.
- **No new backend dependencies** - email uses stdlib `smtplib` / `email.message`. `alembic` is already vendored but stays unused (no migrations in this plan).
- **Best-effort external services** - `services/email.py` must catch, log, and return a falsy value on any failure or misconfiguration; it must never raise to the HTTP layer (CLAUDE.md pattern #1).
- **`backend/.env.example` gets placeholders only** - never a real secret (handoff known-issue #4).
- **Zero-keys demo must keep working** - when SMTP is unconfigured, new users are auto-verified.
- **Keep `pytest -q` green** (start: 80 passing) after every backend task, and **`npm run build` clean** (tsc + vite; it is the frontend typecheck) after every frontend task.
- **No frontend test harness** - frontend tasks verify via `npm run build` + a manual run of both servers. Do not add Vitest/Jest.
- **Claymorphic design tokens** - classes: `clay-card`, `clay-card-hover`, `clay-btn`, `clay-btn-blush`, `clay-input`, `clay-chip`, `skeleton`. Colors: `navy` (#0B1957), `navy-soft`, `blush` (#FA9EBC), `blush-deep`, `blush-soft`, `cream`, `cream-soft`, `cream-deep`.
- **DB reset (dev only):** two new columns are added with no Alembic, so before running the dev server the developer must delete `backend/wardrobe.db` (it auto-recreates). Tests are unaffected (in-memory DB rebuilt per test).
- **Repo root is `Wardrobe builder app/`.** All paths below are relative to it. Backend commands run from `backend/`, frontend from `frontend/`.

---

## Task 1: User schema - `email_verified` + `avatar_key` columns and serialization

**Files:**
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/schemas/auth.py` (UserOut)
- Modify: `backend/app/schemas/profile.py` (ProfileOut)
- Modify: `backend/app/routers/profile.py` (`_serialize`)
- Test: `backend/tests/test_auth.py` (add one test)

**Interfaces:**
- Produces: `User.email_verified: bool` (default False), `User.avatar_key: Optional[str]`; `UserOut.email_verified: bool`; `ProfileOut.avatar_url: Optional[str]`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_auth.py`:

```python
def test_new_user_exposes_verification_and_avatar_fields(client: TestClient):
    _register(client, email="fields@example.com")
    token = _login(client, email="fields@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/auth/me", headers=headers).json()
    assert "email_verified" in me

    profile = client.get("/profile", headers=headers).json()
    assert "avatar_url" in profile
    assert profile["avatar_url"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_auth.py::test_new_user_exposes_verification_and_avatar_fields -v`
Expected: FAIL - `me` has no `email_verified` key (KeyError/assert) or profile has no `avatar_url`.

- [ ] **Step 3: Add the model columns**

In `backend/app/models/user.py`, add `Boolean` to the sqlalchemy import:

```python
from sqlalchemy import Boolean, DateTime, Float, Integer, String
```

Add these columns to `User` (after `hashed_password`):

```python
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
```

- [ ] **Step 4: Add the schema fields**

In `backend/app/schemas/auth.py`, add `email_verified` to `UserOut` (right after `email`):

```python
    id: int
    email: EmailStr
    email_verified: bool
    city: Optional[str] = None
```

In `backend/app/schemas/profile.py`, add `avatar_url` to `ProfileOut`:

```python
    style_preferences: Optional[dict] = None
    plan: str
    avatar_url: Optional[str] = None
```

- [ ] **Step 5: Serialize `avatar_url`**

In `backend/app/routers/profile.py`, add the storage import near the top:

```python
from app.storage import get_storage
```

Update `_serialize` to include the avatar URL:

```python
def _serialize(user: User) -> ProfileOut:
    storage = get_storage()
    return ProfileOut(
        id=user.id,
        email=user.email,
        city=user.city,
        lat=user.lat,
        lon=user.lon,
        style_preferences=_parse_prefs(user.style_preferences),
        plan=user.plan,
        avatar_url=storage.url(user.avatar_key) if user.avatar_key else None,
    )
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_auth.py::test_new_user_exposes_verification_and_avatar_fields -v`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `pytest -q`
Expected: all pass (81+).

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/user.py backend/app/schemas/auth.py backend/app/schemas/profile.py backend/app/routers/profile.py backend/tests/test_auth.py
git commit -m "feat(account): add email_verified + avatar_key to User and expose in schemas"
```

---

## Task 2: `services/email.py` - best-effort SMTP gateway + config + env template

**Files:**
- Create: `backend/app/services/email.py`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Modify: `backend/tests/conftest.py` (blank SMTP keys)
- Test: `backend/tests/test_email.py`

**Interfaces:**
- Produces: `email.available() -> bool`, `email.send(to, subject, html, text) -> bool`, `email.send_verification_email(to, link) -> bool`.
- Consumes: settings `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`, `smtp_starttls`.

- [ ] **Step 1: Add settings**

In `backend/app/config.py`, add after the Quota block (before the closing of `Settings`):

```python
    # Email (SMTP - signup confirmation). All optional; when unset, email
    # verification is skipped and new users are auto-verified (best-effort,
    # like every other integration).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    email_verify_expire_minutes: int = 1440  # 24h
```

- [ ] **Step 2: Blank SMTP keys in tests**

In `backend/tests/conftest.py`, add the SMTP env keys to the blanking loop so a developer's real `.env` can never make email "available" during tests:

```python
for _key in (
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "OPENWEATHER_API_KEY",
    "SERPAPI_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
):
    os.environ[_key] = ""
```

- [ ] **Step 3: Write the failing test**

Create `backend/tests/test_email.py`:

```python
from __future__ import annotations

from app.services import email


def test_email_unavailable_without_config():
    assert email.available() is False


def test_send_returns_false_when_unconfigured():
    assert email.send("x@example.com", "Hi", "<b>hi</b>", "hi") is False


def test_send_verification_email_noops_without_config():
    assert email.send_verification_email("x@example.com", "http://x/?verify_token=abc") is False
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pytest tests/test_email.py -v`
Expected: FAIL - `ModuleNotFoundError: app.services.email`.

- [ ] **Step 5: Implement the gateway**

Create `backend/app/services/email.py`:

```python
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

    msg = EmailMessage()
    msg["From"] = s.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_email.py -v`
Expected: PASS (all three).

- [ ] **Step 7: Add placeholders to the env template**

In `backend/.env.example`, add this section after the Quota block (placeholders only - no real values):

```bash
# --- Email (SMTP for signup confirmation) ---
# All optional. When unset, email verification is skipped (new users are
# auto-verified) so the app still runs with no mail server. For Gmail use an
# App Password; for local testing, Mailtrap works well.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
# From header, e.g. "BetterDresser <no-reply@yourdomain.com>"
SMTP_FROM=
SMTP_STARTTLS=true
EMAIL_VERIFY_EXPIRE_MINUTES=1440
```

- [ ] **Step 8: Run the full suite**

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/email.py backend/app/config.py backend/.env.example backend/tests/conftest.py backend/tests/test_email.py
git commit -m "feat(email): add best-effort SMTP gateway and settings"
```

---

## Task 3: Email verification tokens in `security.py`

**Files:**
- Modify: `backend/app/core/security.py`
- Test: `backend/tests/test_auth.py` (add tests)

**Interfaces:**
- Consumes: settings `email_verify_expire_minutes` (Task 2), `jwt_secret`, `jwt_algorithm`.
- Produces: `create_email_token(user_id: int) -> str`, `decode_email_token(token: str) -> Optional[int]`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_auth.py` (top-level imports and tests):

```python
from app.core.security import (
    create_access_token,
    create_email_token,
    decode_email_token,
)


def test_email_token_roundtrips():
    assert decode_email_token(create_email_token(42)) == 42


def test_email_token_rejects_a_plain_access_token():
    # An access token has no verify purpose, so it must not verify emails.
    assert decode_email_token(create_access_token(subject=42)) is None


def test_email_token_rejects_garbage():
    assert decode_email_token("not-a-token") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_auth.py::test_email_token_roundtrips -v`
Expected: FAIL - `ImportError: cannot import name 'create_email_token'`.

- [ ] **Step 3: Implement the token helpers**

In `backend/app/core/security.py`, add after `decode_access_token`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_auth.py -k email_token -v`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/security.py backend/tests/test_auth.py
git commit -m "feat(email): add signed email-verification tokens"
```

---

## Task 4: Auth router - verify-before-use gate, verify + resend endpoints

**Files:**
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/schemas/auth.py` (VerifyRequest, ResendRequest)
- Test: `backend/tests/test_auth.py` (add flow tests)

**Interfaces:**
- Consumes: `email.available/send_verification_email` (Task 2), `create_email_token/decode_email_token` (Task 3), `User.email_verified` (Task 1).
- Produces: `POST /auth/verify` → `Token`; `POST /auth/resend-verification` → `{detail}`; register now gates on email; login raises 403 when unverified.

- [ ] **Step 1: Add request schemas**

In `backend/app/schemas/auth.py`, add:

```python
class VerifyRequest(BaseModel):
    token: str


class ResendRequest(BaseModel):
    email: EmailStr
```

- [ ] **Step 2: Write the failing tests**

Add to `backend/tests/test_auth.py`:

```python
def test_register_auto_verifies_without_email_service(client: TestClient):
    r = _register(client, email="auto@example.com")
    assert r.json()["email_verified"] is True
    assert _login(client, email="auto@example.com").status_code == 200


def test_email_gate_full_flow(client: TestClient, monkeypatch):
    from app.services import email

    sent = []
    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(
        email, "send_verification_email", lambda to, link: sent.append((to, link)) or True
    )

    r = _register(client, email="gate@example.com")
    assert r.status_code == 201
    assert r.json()["email_verified"] is False

    # Cannot log in until verified.
    assert _login(client, email="gate@example.com").status_code == 403

    # A verification email was queued (background task ran) with a link token.
    assert sent and "verify_token=" in sent[0][1]

    token = create_email_token(r.json()["id"])
    verified = client.post("/auth/verify", json={"token": token})
    assert verified.status_code == 200
    assert verified.json()["access_token"]

    # Now login works.
    assert _login(client, email="gate@example.com").status_code == 200


def test_verify_rejects_bad_token(client: TestClient):
    assert client.post("/auth/verify", json={"token": "garbage"}).status_code == 400


def test_resend_always_returns_200(client: TestClient, monkeypatch):
    from app.services import email

    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(email, "send_verification_email", lambda to, link: True)
    r = client.post("/auth/resend-verification", json={"email": "nobody@example.com"})
    assert r.status_code == 200
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_auth.py::test_email_gate_full_flow -v`
Expected: FAIL - no `/auth/verify` route (404) / register doesn't gate.

- [ ] **Step 4: Rewrite the auth router**

Replace the contents of `backend/app/routers/auth.py` with:

```python
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_email_token,
    decode_email_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import ResendRequest, Token, UserCreate, UserOut, VerifyRequest
from app.services import email

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_user_by_email(db: Session, address: str) -> User | None:
    return db.execute(select(User).where(User.email == address)).scalar_one_or_none()


def _verification_link(token: str) -> str:
    base = get_settings().frontend_base_url.rstrip("/")
    return f"{base}/?verify_token={token}"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
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
        email=payload.email,
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


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2 spec uses `username`; we treat it as the email.
    user = _get_user_by_email(db, form_data.username)
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your email address before signing in.",
        )
    return Token(access_token=create_access_token(subject=user.id))


@router.post("/verify", response_model=Token)
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


@router.post("/resend-verification")
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


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
```

- [ ] **Step 5: Run the auth tests**

Run: `pytest tests/test_auth.py -v`
Expected: PASS (existing + new). Existing tests still pass because email is unavailable in tests → register auto-verifies → login succeeds.

- [ ] **Step 6: Run the full suite**

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/auth.py backend/app/schemas/auth.py backend/tests/test_auth.py
git commit -m "feat(email): gate login on verification, add verify + resend endpoints"
```

---

## Task 5: Account backend - avatar, password change, hard-delete

**Files:**
- Modify: `backend/app/routers/profile.py`
- Test: `backend/tests/test_account.py`

**Interfaces:**
- Consumes: `process_upload`/`InvalidImageError` (`services.images`), `get_storage()`, `verify_password`/`hash_password`, `User.avatar_key` (Task 1), models `Garment`/`CalendarEvent`/`RecommendationEvent`.
- Produces: `POST /profile/avatar` → `ProfileOut`; `DELETE /profile/avatar` → `ProfileOut`; `POST /profile/password` → `{detail}`; `DELETE /profile` → 204.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_account.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, sample_image_bytes


def test_avatar_upload_then_remove(client: TestClient):
    headers = auth_headers(client, email="av@example.com")
    up = client.post(
        "/profile/avatar",
        headers=headers,
        files={"file": ("a.png", sample_image_bytes(), "image/png")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["avatar_url"]

    rm = client.delete("/profile/avatar", headers=headers)
    assert rm.status_code == 200
    assert rm.json()["avatar_url"] is None


def test_avatar_upload_rejects_non_image(client: TestClient):
    headers = auth_headers(client, email="av2@example.com")
    bad = client.post(
        "/profile/avatar",
        headers=headers,
        files={"file": ("x.txt", b"not an image", "text/plain")},
    )
    assert bad.status_code == 400


def test_change_password(client: TestClient):
    headers = auth_headers(client, email="pw@example.com", password="supersecret1")

    wrong = client.post(
        "/profile/password",
        headers=headers,
        json={"current_password": "wrongpass1", "new_password": "brandnew123"},
    )
    assert wrong.status_code == 400

    ok = client.post(
        "/profile/password",
        headers=headers,
        json={"current_password": "supersecret1", "new_password": "brandnew123"},
    )
    assert ok.status_code == 200

    # Old password no longer works; new one does.
    assert client.post(
        "/auth/login", data={"username": "pw@example.com", "password": "supersecret1"}
    ).status_code == 401
    assert client.post(
        "/auth/login", data={"username": "pw@example.com", "password": "brandnew123"}
    ).status_code == 200


def test_delete_account_removes_user_and_data(client: TestClient):
    headers = auth_headers(client, email="del@example.com")
    client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("a.png", sample_image_bytes(), "image/png")},
    )
    client.post(
        "/calendar/events",
        headers=headers,
        json={"title": "Thing", "date": "2026-07-14", "event_type": "casual"},
    )

    resp = client.delete("/profile", headers=headers)
    assert resp.status_code == 204

    # Token now resolves to a deleted user → 401.
    assert client.get("/auth/me", headers=headers).status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_account.py -v`
Expected: FAIL - routes 404 / 405.

- [ ] **Step 3: Implement the endpoints**

In `backend/app/routers/profile.py`, extend the imports at the top:

```python
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import delete

from app.core.security import hash_password, verify_password
from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.models.recommendation_event import RecommendationEvent
from app.services.images import InvalidImageError, process_upload
```

(Keep the existing `from pydantic import BaseModel, Field` and `from app.services import trends, weather` lines. Merge the `fastapi` import so it includes `File`, `Response`, `UploadFile`, `status`, `Query` - they are all listed above.)

Add these endpoints to `backend/app/routers/profile.py` (after `set_location`, before `current_trends`):

```python
@router.post("/profile/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    try:
        processed = process_upload(raw)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage = get_storage()
    old_key = current_user.avatar_key
    key = storage.save(processed.thumbnail_bytes, f"avatar_{uuid.uuid4().hex}.jpg")
    current_user.avatar_key = key
    db.commit()
    db.refresh(current_user)
    if old_key:
        storage.delete(old_key)
    return _serialize(current_user)


@router.delete("/profile/avatar", response_model=ProfileOut)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    if current_user.avatar_key:
        get_storage().delete(current_user.avatar_key)
        current_user.avatar_key = None
        db.commit()
        db.refresh(current_user)
    return _serialize(current_user)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/profile/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated"}


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Permanently delete the account and all of its data."""
    storage = get_storage()
    garments = db.execute(
        select(Garment).where(Garment.user_id == current_user.id)
    ).scalars().all()
    for g in garments:
        storage.delete(g.image_path)
        storage.delete(g.thumbnail_path)
    if current_user.avatar_key:
        storage.delete(current_user.avatar_key)

    db.execute(delete(Garment).where(Garment.user_id == current_user.id))
    db.execute(delete(CalendarEvent).where(CalendarEvent.user_id == current_user.id))
    db.execute(delete(RecommendationEvent).where(RecommendationEvent.user_id == current_user.id))
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Note: `select` is already imported in `profile.py`? It is not - add `from sqlalchemy import delete, select` (the file currently imports neither at module top; `delete` and `select` are both used above, so import both).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_account.py -v`
Expected: PASS (all four).

- [ ] **Step 5: Run the full suite**

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/profile.py backend/tests/test_account.py
git commit -m "feat(account): avatar upload/remove, password change, hard account delete"
```

---

## Task 6: Invisible cursor (blob only)

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/BlobCursor.tsx`

**Interfaces:** none (self-contained).

- [ ] **Step 1: Hide the OS cursor on mouse devices**

In `frontend/src/index.css`, append at the very bottom (outside the `@layer`):

```css
/* The blob cursor is the only pointer on mouse (fine-pointer) devices - hide
   the OS cursor everywhere. Touch devices (coarse pointer) are unaffected. */
@media (pointer: fine) {
  *,
  *::before,
  *::after {
    cursor: none !important;
  }
}
```

- [ ] **Step 2: Render the blob at all widths on mouse devices**

Replace `frontend/src/components/BlobCursor.tsx` with:

```tsx
// Blob Cursor (reactbits.dev-style): gooey blobs that trail the pointer.
// SVG "goo" filter + requestAnimationFrame lerp; no dependencies.
// Pointer-events: none, so it never interferes with the UI. Mouse devices
// only - on touch (coarse pointer) it renders nothing and the OS cursor is
// left alone (see the `(pointer: fine)` rule in index.css).
import { useEffect, useRef, useState } from "react";

const BLOBS = [
  { size: 44, lerp: 0.55, opacity: 0.5 },
  { size: 32, lerp: 0.32, opacity: 0.42 },
  { size: 20, lerp: 0.18, opacity: 0.38 },
];

export default function BlobCursor({ color = "#FA9EBC" }: { color?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.matchMedia("(pointer: fine)").matches);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const blobs = Array.from(containerRef.current?.children ?? []) as HTMLElement[];
    const mouse = { x: -100, y: -100 };
    const pos = BLOBS.map(() => ({ x: -100, y: -100 }));

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      BLOBS.forEach((cfg, i) => {
        pos[i].x += (mouse.x - pos[i].x) * cfg.lerp;
        pos[i].y += (mouse.y - pos[i].y) * cfg.lerp;
        const el = blobs[i];
        if (el) {
          el.style.transform = `translate(${pos[i].x - cfg.size / 2}px, ${
            pos[i].y - cfg.size / 2
          }px)`;
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <filter id="blob-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
          />
        </filter>
      </svg>
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{ filter: "url(#blob-goo)" }}
        aria-hidden="true"
      >
        {BLOBS.map((b, i) => (
          <div
            key={i}
            className="absolute top-0 left-0 rounded-full"
            style={{
              width: b.size,
              height: b.size,
              background: color,
              opacity: b.opacity,
              willChange: "transform",
            }}
          />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Typecheck / build**

Run (from `frontend/`): `npm run build`
Expected: clean (no tsc errors).

- [ ] **Step 4: Manual verification**

Run both servers (`uvicorn app.main:app --reload` in `backend/`, `npm run dev` in `frontend/`). Open http://localhost:5173 on a desktop browser: the OS arrow is gone and only the blush blob follows the mouse, including over buttons and inputs. Resize narrow - the blob still shows. (On a touch device / dev-tools mobile emulation the normal behavior returns.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/BlobCursor.tsx
git commit -m "feat(cursor): hide the OS cursor so only the blob cursor shows"
```

---

## Task 7: Reusable `ConfirmDialog` + wire wardrobe & calendar deletes

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Modify: `frontend/src/pages/Wardrobe.tsx`
- Modify: `frontend/src/pages/Calendar.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` with props `{ open, title, message, confirmLabel?, cancelLabel?, requireText?, onConfirm, onCancel }`. When `requireText` is set, Confirm stays disabled until the user types that exact string. (Consumed here and by Task 9's delete-account flow.)

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ConfirmDialog.tsx`:

```tsx
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, the user must type this exact string to enable Confirm. */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const confirmDisabled = requireText ? typed !== requireText : false;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="clay-card w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-navy/60">{message}</p>
        {requireText && (
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            className="w-full clay-input"
          />
        )}
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} className="clay-btn-blush px-4 py-2 text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-2xl bg-red-500 text-white font-medium px-4 py-2 text-sm shadow-clay-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 active:translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the wardrobe delete**

In `frontend/src/pages/Wardrobe.tsx`:

1. Add the import near the other component imports:

```tsx
import ConfirmDialog from "../components/ConfirmDialog";
```

2. Add confirm state alongside the other `useState` hooks (e.g. after `const [error, setError] = useState<string | null>(null);`):

```tsx
  const [confirmId, setConfirmId] = useState<number | null>(null);
```

3. Change the Delete button's handler (currently `onClick={() => removeItem(g.id)}`) to open the dialog:

```tsx
                <button
                  onClick={() => setConfirmId(g.id)}
                  className="text-blush-deep text-xs font-medium hover:underline"
                >
                  Delete
                </button>
```

4. Just before the final closing `</div>` of the page's returned JSX (the one that closes `<div ref={pageRef}>`), render the dialog:

```tsx
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete item?"
        message="This removes the item from your wardrobe. This can't be undone."
        onConfirm={() => {
          if (confirmId !== null) removeItem(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
```

- [ ] **Step 3: Wire the calendar delete**

In `frontend/src/pages/Calendar.tsx`:

1. Add the import:

```tsx
import ConfirmDialog from "../components/ConfirmDialog";
```

2. Add confirm state after `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const pendingEvent = events.find((e) => e.id === confirmId) ?? null;
```

3. Change the Delete button handler (currently `onClick={() => remove(ev.id)}`) to:

```tsx
              <button
                onClick={() => setConfirmId(ev.id)}
                className="text-blush-deep text-xs font-medium hover:underline"
              >
                Delete
              </button>
```

4. Just before the final closing `</div>` (closing `<div ref={pageRef}>`), render:

```tsx
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete event?"
        message={
          pendingEvent
            ? `Delete "${pendingEvent.title}"? This can't be undone.`
            : ""
        }
        onConfirm={() => {
          if (confirmId !== null) remove(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
```

- [ ] **Step 4: Build**

Run (from `frontend/`): `npm run build`
Expected: clean.

- [ ] **Step 5: Manual verification**

With both servers running: on Wardrobe and Calendar, clicking Delete now opens a claymorphic modal; Cancel/Escape/backdrop dismiss it and nothing is deleted; Delete removes the item. Confirm the optimistic removal still works (item disappears immediately).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/pages/Wardrobe.tsx frontend/src/pages/Calendar.tsx
git commit -m "feat(delete): confirm dialog before deleting wardrobe items and events"
```

---

## Task 8: Email-verification frontend (register/login UX + verify link)

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/auth.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Login.tsx`

**Interfaces:**
- Consumes: backend `/auth/verify`, `/auth/resend-verification`, register/login gate (Tasks 4).
- Produces: `api.verifyEmail(token)`, `api.resendVerification(email)`; `useAuth().register` now returns the created `User`; `useAuth().verifyEmail(token)`.

- [ ] **Step 1: Extend the API client**

In `frontend/src/api.ts`, add `email_verified` to the `User` interface:

```tsx
export interface User {
  id: number;
  email: string;
  email_verified?: boolean;
  plan: string;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
}
```

Add these methods to the `api` object (after `register`):

```tsx
  verifyEmail: async (token: string) => {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json();
    if (!res.ok) throw new ApiError(res.status, body?.detail ?? "Verification failed");
    setToken(body.access_token);
    return body.access_token as string;
  },

  resendVerification: (email: string) =>
    request<{ detail: string }>("/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
```

- [ ] **Step 2: Update the auth context**

In `frontend/src/auth.tsx`, import `User`:

```tsx
import { api, clearToken, getToken, User } from "./api";
```

Change the `AuthState` interface `register` and add `verifyEmail`:

```tsx
  register: (email: string, password: string) => Promise<User>;
  verifyEmail: (token: string) => Promise<void>;
```

Replace the `register` function and add `verifyEmail`:

```tsx
  const register = async (email: string, password: string) => {
    const created = await api.register(email, password);
    // If the account is already verified (no email service configured), log in.
    if (created.email_verified) {
      await login(email, password);
    }
    return created;
  };

  const verifyEmail = async (token: string) => {
    await api.verifyEmail(token);
    await refresh();
  };
```

Add `verifyEmail` to the context value:

```tsx
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, logout, refresh }}>
```

- [ ] **Step 3: Handle the verify link in `App.tsx`**

In `frontend/src/App.tsx`, pull `verifyEmail` from `useAuth` and add a landing effect + banner.

Change the destructure:

```tsx
  const { user, loading, logout, verifyEmail } = useAuth();
```

Add state after it:

```tsx
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
```

Add this effect (near the other `useEffect`s):

```tsx
  // Email verification landing: the confirmation email links to
  // `/?verify_token=...`. Verify once on load, then strip the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify_token");
    if (!token) return;
    verifyEmail(token)
      .then(() => setVerifyMsg("Email confirmed - you're all set!"))
      .catch(() => setVerifyMsg("That confirmation link is invalid or has expired."))
      .finally(() => {
        params.delete("verify_token");
        const q = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Render the banner: immediately inside the returned `<ClickSpark>` (right after `<BlobCursor />`), add:

```tsx
      {verifyMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9995] clay-card px-5 py-2 text-sm">
          {verifyMsg}
          <button onClick={() => setVerifyMsg(null)} className="ml-3 text-navy/40 hover:text-navy">×</button>
        </div>
      )}
```

- [ ] **Step 4: Update the Login page**

Replace `frontend/src/pages/Login.tsx` with:

```tsx
import { useState } from "react";
import { useAuth } from "../auth";
import { useFadeRise } from "../animations";
import { api, ApiError } from "../api";

export default function Login() {
  const cardRef = useFadeRise<HTMLFormElement>();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const created = await register(email, password);
        if (!created.email_verified) {
          setNeedsConfirm(true);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNeedsConfirm(true); // unverified email on login
      } else {
        setError((err as Error).message ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResendMsg(null);
    try {
      await api.resendVerification(email);
      setResendMsg("Confirmation email sent. Check your inbox.");
    } catch {
      setResendMsg("Couldn't resend right now - try again shortly.");
    }
  };

  if (needsConfirm) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm clay-card p-8 space-y-4 text-center">
          <h1 className="font-brand text-4xl tracking-wide">Check your email</h1>
          <p className="text-sm text-navy/60">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <button onClick={resend} className="clay-btn px-5 py-2.5 w-full">
            Resend email
          </button>
          {resendMsg && <p className="text-sm text-navy/50">{resendMsg}</p>}
          <button
            onClick={() => {
              setNeedsConfirm(false);
              setMode("login");
            }}
            className="text-sm text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 pt-16">
      <form
        ref={cardRef}
        onSubmit={submit}
        className="w-full max-w-sm clay-card clay-card-hover p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="font-brand text-5xl tracking-wide">
            Better<span className="text-blush-deep">Dresser</span>
          </h1>
          <p className="text-sm text-navy/50 mt-1">
            {mode === "login" ? "Sign in to your wardrobe" : "Create your account"}
          </p>
        </div>

        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full clay-input"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full clay-input"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={busy} className="w-full clay-btn py-2.5">
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="text-center text-sm text-navy/50">
          {mode === "login" ? "No account?" : "Already have one?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Build**

Run (from `frontend/`): `npm run build`
Expected: clean.

- [ ] **Step 6: Manual verification**

Two paths:
- **No SMTP configured (default):** register → you're logged straight in (auto-verified). Confirms the zero-keys demo still works.
- **SMTP configured (set `SMTP_HOST`/`SMTP_FROM`/… in `backend/.env`, e.g. a Mailtrap inbox):** register → "Check your email" panel; try to sign in → same panel (403). Open the link from the email (or the one logged to the uvicorn console) → lands on the app confirmed + logged in, banner shows. "Resend email" sends another.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api.ts frontend/src/auth.tsx frontend/src/App.tsx frontend/src/pages/Login.tsx
git commit -m "feat(email): signup confirmation UX and verify-link landing"
```

---

## Task 9: Account menu (avatar + dropdown + plan badge + settings/customization/delete)

**Files:**
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/components/Modal.tsx`
- Create: `frontend/src/components/AccountSettings.tsx`
- Create: `frontend/src/components/Customization.tsx`
- Create: `frontend/src/components/AccountMenu.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 7), `profileCache` (`store.ts`), `useAuth().logout`, backend account endpoints (Task 5).
- Produces: `api.uploadAvatar/removeAvatar/changePassword/deleteAccount`; `<AccountMenu onUpgrade={() => void} />`.

- [ ] **Step 1: Extend the API client**

In `frontend/src/api.ts`, add `avatar_url` and `style_preferences` to the `User` interface:

```tsx
export interface User {
  id: number;
  email: string;
  email_verified?: boolean;
  plan: string;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  avatar_url?: string | null;
  style_preferences?: Record<string, unknown> | null;
}
```

Widen `updateProfile` to accept style preferences, and add the account methods (place near the profile methods):

```tsx
  updateProfile: (
    data: Partial<{ city: string; lat: number; lon: number; style_preferences: Record<string, unknown> }>
  ) =>
    request<User>("/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<User>("/profile/avatar", { method: "POST", body: fd });
  },
  removeAvatar: () => request<User>("/profile/avatar", { method: "DELETE" }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ detail: string }>("/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password, new_password }),
    }),
  deleteAccount: () => request<void>("/profile", { method: "DELETE" }),
```

(Replace the existing `updateProfile` definition with the widened one above - do not leave two.)

- [ ] **Step 2: Create the generic Modal shell**

Create `frontend/src/components/Modal.tsx`:

```tsx
import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="clay-card w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-navy/40 hover:text-navy text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the Account settings panel**

Create `frontend/src/components/AccountSettings.tsx`:

```tsx
import { useRef, useState } from "react";
import { api, User } from "../api";

interface Props {
  profile: User | null;
  email: string;
  onProfileChange: (u: User) => void;
}

export default function AccountSettings({ profile, email, onProfileChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [city, setCity] = useState(profile?.city ?? "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    wrap(async () => {
      onProfileChange(await api.uploadAvatar(f));
      setMsg("Photo updated.");
    }).finally(() => {
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const removeAvatar = () =>
    wrap(async () => {
      onProfileChange(await api.removeAvatar());
    });

  const saveLocation = () => {
    if (city.trim().length < 2) return;
    wrap(async () => {
      onProfileChange(await api.setLocation(city.trim()));
      setMsg("Location saved.");
    });
  };

  const savePassword = () =>
    wrap(async () => {
      await api.changePassword(curPw, newPw);
      setCurPw("");
      setNewPw("");
      setMsg("Password updated.");
    });

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="text-navy/50 mb-1">Email</p>
        <p className="font-medium break-all">{email}</p>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Profile photo</p>
        <div className="flex gap-2 items-center">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <label className="clay-btn px-4 py-2 cursor-pointer">
            {busy ? "…" : "Upload"}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </label>
          {profile?.avatar_url && (
            <button onClick={removeAvatar} className="clay-btn-blush px-4 py-2">
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Location</p>
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="flex-1 clay-input"
          />
          <button onClick={saveLocation} className="clay-btn px-4 py-2">
            Save
          </button>
        </div>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Change password</p>
        <div className="space-y-2">
          <input
            type="password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            placeholder="Current password"
            className="w-full clay-input"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 8)"
            className="w-full clay-input"
          />
          <button
            onClick={savePassword}
            disabled={busy || curPw.length < 1 || newPw.length < 8}
            className="clay-btn px-4 py-2"
          >
            Update password
          </button>
        </div>
      </div>

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-500">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create the Customization panel**

Create `frontend/src/components/Customization.tsx`:

```tsx
import { useState } from "react";
import { api, User } from "../api";

interface Props {
  profile: User | null;
  onProfileChange: (u: User) => void;
}

export default function Customization({ profile, onProfileChange }: Props) {
  const prefs = (profile?.style_preferences ?? {}) as { styles?: string[]; avoid?: string[] };
  const [styles, setStyles] = useState((prefs.styles ?? []).join(", "));
  const [avoid, setAvoid] = useState((prefs.avoid ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const updated = await api.updateProfile({
        style_preferences: { styles: toList(styles), avoid: toList(avoid) },
      });
      onProfileChange(updated);
      setMsg("Style preferences saved.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-navy/50">These guide your AI outfit and buy-next suggestions.</p>
      <div>
        <p className="text-navy/50 mb-1">Styles you like</p>
        <input
          value={styles}
          onChange={(e) => setStyles(e.target.value)}
          placeholder="minimal, streetwear, classic"
          className="w-full clay-input"
        />
      </div>
      <div>
        <p className="text-navy/50 mb-1">Things to avoid</p>
        <input
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="neon, big logos"
          className="w-full clay-input"
        />
      </div>
      <button onClick={save} disabled={busy} className="clay-btn px-4 py-2">
        Save
      </button>
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-500">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create the Account menu**

Create `frontend/src/components/AccountMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { api, User } from "../api";
import { useAuth } from "../auth";
import { profileCache } from "../store";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import AccountSettings from "./AccountSettings";
import Customization from "./Customization";

type Panel = "settings" | "customize" | "delete" | null;

export default function AccountMenu({ onUpgrade }: { onUpgrade: () => void }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(profileCache.peek());
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileCache.get().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const plan = profile?.plan ?? user?.plan ?? "free";
  const isPaid = plan === "paid";
  const email = user?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? null;
  const initial = email ? email[0].toUpperCase() : "?";

  const refreshProfile = (u: User) => {
    profileCache.set(u);
    setProfile(u);
  };

  const del = async () => {
    await api.deleteAccount();
    logout();
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-3">
        <button
          onClick={onUpgrade}
          className={`clay-chip ${isPaid ? "" : "hover:bg-blush"}`}
          title={isPaid ? "You're on Plus" : "Upgrade to Plus"}
        >
          {isPaid ? "Plus" : "Free · Upgrade"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-10 h-10 rounded-full overflow-hidden shadow-clay-sm bg-navy text-cream flex items-center justify-center font-semibold"
          aria-label="Account menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-2 w-56 clay-card p-2 z-[9991]">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{email}</p>
            <p className="text-xs text-navy/50">{isPaid ? "Plus plan" : "Free plan"}</p>
          </div>
          <div className="h-px bg-cream-deep my-1" />
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={() => {
              setPanel("settings");
              setOpen(false);
            }}
          >
            Account settings
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={() => {
              setPanel("customize");
              setOpen(false);
            }}
          >
            Customization
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50"
            onClick={() => {
              setPanel("delete");
              setOpen(false);
            }}
          >
            Delete account
          </button>
          <div className="h-px bg-cream-deep my-1" />
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      )}

      <Modal open={panel === "settings"} title="Account settings" onClose={() => setPanel(null)}>
        <AccountSettings profile={profile} email={email} onProfileChange={refreshProfile} />
      </Modal>
      <Modal open={panel === "customize"} title="Customization" onClose={() => setPanel(null)}>
        <Customization profile={profile} onProfileChange={refreshProfile} />
      </Modal>
      <ConfirmDialog
        open={panel === "delete"}
        title="Delete your account?"
        message="This permanently deletes your account and everything in it - wardrobe, calendar, and usage history. This cannot be undone."
        confirmLabel="Delete forever"
        requireText="DELETE"
        onConfirm={del}
        onCancel={() => setPanel(null)}
      />
    </div>
  );
}
```

- [ ] **Step 6: Mount it in the header**

In `frontend/src/App.tsx`:

1. Add the import:

```tsx
import AccountMenu from "./components/AccountMenu";
```

2. Remove `logout` from the `useAuth()` destructure (it moved into `AccountMenu`; leaving it unused fails tsc). It should read (keeping `verifyEmail` from Task 8):

```tsx
  const { user, loading, verifyEmail } = useAuth();
```

3. Replace the header's email + Sign-out block:

```tsx
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-navy/50 hidden sm:inline">{user.email}</span>
                  <button
                    onClick={logout}
                    className="clay-btn-blush px-4 py-1.5 text-sm"
                  >
                    Sign out
                  </button>
                </div>
```

with:

```tsx
                <AccountMenu onUpgrade={() => setTab("upgrade")} />
```

- [ ] **Step 7: Build**

Run (from `frontend/`): `npm run build`
Expected: clean.

- [ ] **Step 8: Manual verification**

With both servers running and signed in:
- The header shows a plan chip ("Free · Upgrade" / "Plus") and a round avatar (initial until a photo is set). Clicking the chip switches to the Plan tab.
- Avatar → dropdown with email, plan, Account settings, Customization, Delete account, Sign out. Outside-click / Escape closes it.
- **Account settings:** upload a photo (avatar updates in the header immediately), remove it, change location, change password (wrong current → error; right → success, and the new password works on next sign-in).
- **Customization:** set styles/avoid, Save; reopen to confirm they persisted.
- **Delete account:** Confirm stays disabled until you type `DELETE`; confirming wipes the account and returns you to the login screen; the old credentials no longer work.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api.ts frontend/src/components/Modal.tsx frontend/src/components/AccountSettings.tsx frontend/src/components/Customization.tsx frontend/src/components/AccountMenu.tsx frontend/src/App.tsx
git commit -m "feat(account): avatar + dropdown menu with settings, customization, and delete"
```

---

## Final verification

- [ ] **Backend:** from `backend/`, run `pytest -q` → all pass (≈90 tests).
- [ ] **Frontend:** from `frontend/`, run `npm run build` → clean.
- [ ] **End-to-end (both servers, fresh `wardrobe.db`):** register (auto-verified with no SMTP) → header avatar + plan chip present → cursor is blob-only on desktop → delete a wardrobe item and a calendar event via the confirm modal → open the account menu, upload/remove an avatar, change password, edit style preferences, and finally delete the account (type `DELETE`) → back to login, old credentials rejected.
- [ ] Update the handoff: append these four features to `handoff.md` (or note them for the next session) and, optionally, add the SMTP keys to `CLAUDE.md`'s Config section.

## Spec coverage check

- Email confirmation (verify-before-use, SMTP, auto-skip, verify auto-login, resend) → Tasks 1–4, 8. ✅
- Invisible cursor (all fine-pointer widths; blob renders everywhere; touch untouched) → Task 6. ✅
- Delete confirmation (reusable clay modal; `requireText`; wardrobe + calendar) → Task 7. ✅
- Account tab (avatar upload in settings, password, location, style-preferences customization, hard delete with type-to-confirm, plan badge, dropdown) → Tasks 1, 5, 9. ✅
- Cross-cutting: DB reset noted; `.env.example` placeholders only; best-effort email; green bars each task. ✅
- Out of scope respected: no display name, no forgot-password, no hosted email SDK, no Alembic, no frontend test harness. ✅
