# Account, Email Confirmation, Cursor & Delete-Confirmation - Design

_Date: 2026-07-14 · Status: approved, ready for implementation planning_

## Summary

Four features for BetterDresser, in one spec because they cluster around account/auth polish:

1. **Email confirmation** - verify-before-use signup gate, sent over stdlib SMTP, that degrades to auto-verify when no mail service is configured.
2. **Invisible cursor** - hide the OS cursor on mouse devices so only the blob cursor shows.
3. **Delete confirmation** - a reusable claymorphic confirm dialog in front of every delete.
4. **Account tab** - an avatar + dropdown in the header (account settings, customization, delete account, sign out) that also shows the user's plan.

All four preserve the app's core rule (CLAUDE.md pattern #1): every external integration is best-effort and the app fully runs with zero secrets.

## Decisions made during brainstorming

- Email confirmation is a **hard gate** (can't log in until verified), **not** a soft banner or a welcome-only email. The verify link **auto-logs the user in** on click. When SMTP is unconfigured, new users are marked verified immediately so the zero-keys demo still works.
- Email transport is **stdlib `smtplib`** behind a best-effort `services/email.py` gateway (mirrors `services/llm.py`), not a hosted API SDK - zero new dependencies.
- Delete confirmations use a **styled claymorphic modal**, not `window.confirm()`.
- The cursor is hidden on **all** fine-pointer (mouse) devices regardless of screen width; touch devices are untouched.
- Profile picture is an **uploadable image** (not an initials-only avatar); its upload control lives in **Account settings** (Customization was scoped to style preferences only).
- **Customization** panel contains **style preferences only**. **Display name is out of scope** (not requested).
- Account deletion is a **hard delete** of the account and all its data, gated by **typing `DELETE`** in the modal.

---

## Feature 1 - Email confirmation

### Behavior

- **Register:** create the user with `email_verified = False`. If `email.available()`, send a verification email (via `BackgroundTasks`, so the HTTP response isn't blocked on SMTP) and leave the user unverified. If email is **not** configured, set `email_verified = True` immediately.
- **Login:** if the password is correct but `email_verified` is `False`, return **403** with a clear message. (401 stays reserved for wrong credentials - the frontend distinguishes them.)
- **Verify:** `POST /auth/verify {token}` decodes the token, sets `email_verified = True`, and returns a `Token` so the click logs the user in.
- **Resend:** `POST /auth/resend-verification {email}` re-sends if the account exists and is unverified; **always returns 200** (no account-enumeration leak).

### Backend

- **`models/user.py`** - add `email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)`.
- **`core/security.py`** - add:
  - `create_email_token(user_id) -> str`: JWT with `{"sub": str(user_id), "purpose": "verify_email", "exp": now + email_verify_expire_minutes}`.
  - `decode_email_token(token) -> Optional[int]`: returns the user id only if the signature is valid, unexpired, **and** `purpose == "verify_email"`; else `None`.
  - Reuses `jose` (already a dependency). No token table - the flag on `User` plus a short-TTL signed token is sufficient.
- **`services/email.py`** *(new, best-effort gateway)*:
  - `available() -> bool`: true when `smtp_host` and `smtp_from` are set to real (non-placeholder) values, using the same placeholder hygiene idea as `llm._real_key`.
  - `send(to, subject, html, text) -> bool`: build a `MIMEMultipart("alternative")`, connect with `smtplib.SMTP` + STARTTLS (or `SMTP_SSL` when the port implies it), authenticate if a user/password is set, send. Catch **all** exceptions, log, return `False`. Never raises.
  - `send_verification_email(to, link) -> bool`: compose a branded plain-text + HTML body and call `send`.
  - When not `available()`: log the verification link to the server console and return `False` (keeps the dev flow usable with no mail server).
- **`routers/auth.py`** - implement the register/login/verify/resend behavior above; `register` takes `BackgroundTasks` and enqueues the send.
- **`config.py`** - add `smtp_host: str = ""`, `smtp_port: int = 587`, `smtp_user: str = ""`, `smtp_password: str = ""`, `smtp_from: str = ""`, `smtp_starttls: bool = True`, `email_verify_expire_minutes: int = 1440`. Reuse existing `frontend_base_url` to build the link: `{frontend_base_url}/?verify_token={token}`.
- **`backend/.env.example`** - add the SMTP keys as **placeholders only** (respect handoff known-issue #4 - no real secrets in the tracked template).

### Frontend

- **`api.ts`** - add `email_verified: boolean` to the user type; `verifyEmail(token)` → `POST /auth/verify` (stores the returned token); `resendVerification(email)`.
- **`auth.tsx`** - `register` auto-logs in **only** if the returned user is already verified (email unconfigured path); otherwise it exposes an "unverified, check your email" state instead of logging in. Add `verifyEmail` to the context.
- **`App.tsx`** - on load, read `?verify_token=` from `window.location.search`; if present, call verify, then strip the param from the URL (`history.replaceState`). This is the verify-link landing (the SPA has no router).
- **`Login.tsx`** - after an unverified register **or** a 403 login, show a "Check your email to confirm your account" panel with a **Resend email** button; a normal 401 keeps the existing inline error.

### Errors / edge cases

- Bad/expired/wrong-purpose token → verify returns **400**.
- Resend for a nonexistent or already-verified email → still **200** (generic).
- SMTP failure at send time → logged, user still created; they can use Resend.

### Tests (`backend/tests/test_auth.py`)

- Email unconfigured (default under `conftest`): register → user auto-verified → login succeeds.
- Email configured (monkeypatch `email.available()` true and capture `email.send`): register → unverified → login **403** → verify with a valid token → login succeeds.
- `resend-verification` triggers a send for an unverified user and returns 200 for unknown emails.
- Verify with an invalid/expired token → 400.

---

## Feature 2 - Invisible cursor

CSS-only plus one small component tweak.

- **`index.css`** - add:
  ```css
  @media (pointer: fine) {
    *, *::before, *::after { cursor: none !important; }
  }
  ```
  `!important` overrides Tailwind's `cursor-pointer` / `cursor-grab` utilities. Fine-pointer only, so touch devices keep their normal behavior.
- **`components/BlobCursor.tsx`** - render at **all** widths on fine-pointer devices so a visible pointer always exists wherever the OS cursor is hidden: drop the `hidden md:block` width gate (keep the `matchMedia("(pointer: coarse)")` early-return that already disables it on touch). To avoid rendering an idle off-screen blob on touch, gate the container on a `pointer: fine` check.

**Tradeoff (accepted):** the system cursor - including the text I-beam in inputs - is hidden on desktop. This is the explicit ask; the blob is the visible pointer.

No automated test (visual/CSS); verified by running the app.

---

## Feature 3 - Delete confirmation

- **`components/ConfirmDialog.tsx`** *(new, reusable)*:
  - Props: `open`, `title`, `message`, `confirmLabel` (default "Delete"), `cancelLabel` (default "Cancel"), `onConfirm`, `onCancel`, `destructive?`, and **`requireText?`** - when set, the user must type that exact string before Confirm enables (used by account deletion).
  - Fixed backdrop + centered `clay-card`; `role="dialog"`, `aria-modal`; Escape and backdrop-click cancel; a soft entrance animation consistent with the app.
- **`pages/Wardrobe.tsx`** - the Delete button opens the dialog ("Delete this item? This can't be undone."); the existing optimistic `removeItem` runs only on confirm.
- **`pages/Calendar.tsx`** - same, message references the event title.

No automated test (no frontend test harness in this repo - backend-only by design); verified by running the app.

---

## Feature 4 - Account tab

### Header + dropdown

- The header's current `{email} + Sign out` block becomes an **avatar button + plan badge** ("Free · Upgrade" or "Plus").
- Clicking the avatar opens a **dropdown**: avatar + email + plan at the top, then **Account settings**, **Customization**, **Delete account**, **Sign out**. Each of the first three opens a modal (no router → modals).
- The plan badge appears both in the header and in the dropdown. "Upgrade" switches to the existing `upgrade` tab.

### Backend

- **`models/user.py`** - add `avatar_key: Mapped[Optional[str]]` (nullable).
- **Storage** - reuse the existing `StorageBackend` / `LocalStorage` (served at `/media`, like garments). Avatar keys look like `avatars/{user_id}/{uuid}.{ext}`.
- **`routers/profile.py`** (+ `schemas/profile.py`):
  - `POST /profile/avatar` (multipart image) - validate it's an image (reuse the Pillow-based validation already used for garment uploads), save via storage, delete the previous avatar file if any, set `avatar_key`, return the profile with `avatar_url`.
  - `DELETE /profile/avatar` - clear `avatar_key` and delete the stored file.
  - `POST /profile/password` `{current_password, new_password}` - verify `current_password`, reject with 400 if wrong, else re-hash and store. `new_password` validated (min length 8) like registration.
  - `DELETE /profile` - **hard delete**: remove the user's garments (and their stored images), calendar events, recommendation-events, and avatar file, then delete the user row → **204**. Factor the per-garment image cleanup into a helper shared with the existing wardrobe delete so image removal isn't duplicated.
  - `ProfileOut` gains `avatar_url: Optional[str]` (computed from `avatar_key` via `storage.url`); `plan` is already present.
- **Tests (`backend/tests/`)** - avatar upload sets `avatar_url` and remove clears it; password change succeeds with the right current password and 400s with the wrong one; `DELETE /profile` removes the user and their rows, and subsequent authenticated calls with the old token 401.

### Frontend

- **`api.ts`** - add `avatar_url` to the profile type; `uploadAvatar(file)`, `removeAvatar()`, `changePassword(current, next)`, `deleteAccount()`.
- **`components/AccountMenu.tsx`** *(new)* - avatar button + dropdown + plan badge; rendered in `App.tsx`'s header, replacing the email/Sign-out block. Closes on outside-click / Escape.
- **Modals:**
  - **Account settings** - email (read-only), **avatar upload + remove**, change password, location/city (reuses `POST /profile/location`).
  - **Customization** - style-preferences editor writing through the existing `PATCH /profile` (`style_preferences`), which already feeds the AI recommender.
  - **Delete account** - `ConfirmDialog` with `requireText="DELETE"`; on confirm, call `deleteAccount()` then log out (clear token, clear user).
- Profile/user cache in `store.ts` is updated after avatar/password/prefs changes so the header reflects them immediately.

---

## Cross-cutting

- **DB reset:** `email_verified` and `avatar_key` are new columns and there is no Alembic (handoff known-issue #3), so `Base.metadata.create_all` won't alter existing tables. The dev `backend/wardrobe.db` must be recreated (existing local accounts are lost). This will be an explicit step in the plan.
- **`.env.example` hygiene:** only placeholder SMTP values go in the tracked template (known-issue #4).
- **Green bars:** `pytest -q` stays green (test count grows from 80) and `npm run build` (tsc + vite) stays clean throughout.
- **Best-effort principle:** `services/email.py` follows the same catch-log-degrade contract as the other services; no email failure ever propagates to the HTTP layer.

## Out of scope

- Display name field.
- Password-reset ("forgot password") flow - only in-session change-password is included.
- Hosted transactional-email provider (SMTP only; the gateway leaves room to add one later).
- Alembic migrations / Postgres (tracked separately in the handoff's next steps).
- Any frontend automated test harness (repo is backend-tested by design).
