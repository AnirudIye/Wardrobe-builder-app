# Forgot Password - Design

_Date: 2026-07-16. Status: implemented this session._

## Goal

Let a user who forgot their password regain access from the login page, via an emailed
reset link, using the already-working SMTP service and the established email-token
pattern. No DB schema change, no Alembic migration.

## Approach chosen: stateless JWT reset token bound to the current password hash

A signed JWT (same secret/algorithm as every other token) with:

- `sub` = user id
- `purpose` = `"reset_password"` (rejects access tokens and verify-email tokens outright)
- `pw` = fingerprint of the user's **current** `hashed_password` (first 16 hex chars of
  its SHA-256)
- `exp` = now + `password_reset_expire_minutes` (new setting, default 60)

The fingerprint is what makes the token effectively **single-use with zero storage**:
resetting the password changes `hashed_password`, so the fingerprint in any outstanding
token no longer matches and it is dead. It also means requesting a newer reset link does
not invalidate an older unexpired one (acceptable: both go to the same inbox, and both
die the moment either is used).

### Alternatives rejected

1. **DB-stored one-time token** (column or table): real revocability, but needs an
   Alembic migration and more moving parts for no practical gain at this scale.
2. **Reuse `create_email_token`**: purpose confusion - any stale confirmation email
   would double as a password-reset key, and it lives 24h.

## Backend

- `core/security.py`: `create_reset_token(user_id, hashed_password)` and
  `decode_reset_token(token) -> Optional[Tuple[int, str]]` (user id + fingerprint;
  caller compares against the live hash). Fingerprint helper is private.
- `config.py`: `password_reset_expire_minutes: int = 60`.
- `services/email.py`: `send_password_reset_email(to, link)` mirroring
  `send_verification_email` (best-effort, returns bool, never raises).
- `schemas/auth.py`: `ForgotPasswordRequest { email }`,
  `ResetPasswordRequest { token, password }` (password rules identical to `UserCreate`:
  min 8, max 128).
- `routers/auth.py`:
  - `POST /auth/forgot-password` - always the same generic 200 whether or not the
    account exists (anti-enumeration, mirrors `/auth/resend-verification`). When the
    user exists and `email.available()`, queues `send_password_reset_email` as a
    background task with link `{frontend_base_url}/?reset_token=...`. Rate limit
    5/hour per IP (tightest tier: it sends real email).
  - `POST /auth/reset-password` - decodes the token, requires `purpose` match, live
    user, and fingerprint match; any failure is a single undifferentiated
    400 "Invalid or expired reset link". On success: re-hash the new password, set
    `email_verified = True` (redeeming a link mailed to the address proves inbox
    ownership - the exact property verification certifies; also prevents a locked-out
    unverified user from being stuck), commit, and return a `Token` so the SPA signs
    the user straight in (mirrors `/auth/verify`). Rate limit 10/min per IP.

## Frontend

- `api.ts`: `forgotPassword(email)` via `request()`; `resetPassword(token, password)`
  as a raw fetch that stores the returned access token (mirrors `verifyEmail`).
- `auth.tsx`: `resetPassword(token, password)` = api call + `refresh()`.
- `App.tsx`: on load, capture `?reset_token=` into state, strip it from the URL
  (same pattern as `verify_token`), start on the login view, and pass the token to
  `Login`.
- `Login.tsx`: a "Forgot password?" link in login mode opens a **forgot view**
  (email form; submit always lands on a "check your email" style card with the generic
  message). When a `resetToken` prop is present, Login opens directly in a **reset
  view** (single new-password field; submit auto-signs-in via the returned token; a 400
  shows the error plus a button to request a fresh link).

## Error handling

Everything follows the house best-effort contract: email sending never raises,
`forgot-password` never reveals account existence, `reset-password` collapses every
failure mode into one 400 message, and a failed reset leaves the old password working.

## Testing

Backend (pytest, TDD): token roundtrip and purpose/garbage rejection; forgot-password
generic 200 for known and unknown emails; email actually queued (monkeypatched) with a
`reset_token=` link for known emails only; full flow (register → forgot → reset → old
password 401, new password 200); token reuse after reset rejected (single-use);
short password 422; reset verifies a previously unverified user; email-service no-op
without config. Frontend: `npm run build` (tsc) clean; manual flow check.
