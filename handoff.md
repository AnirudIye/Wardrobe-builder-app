# BetterDresser — Handoff

_Last updated: 2026-07-15_

## Goal

BetterDresser is a portfolio-grade web app for managing a digital wardrobe and getting AI styling help. A logged-in user:

- Signs up with **email confirmation** (verify-before-use), manages their **account** (profile photo, password, location, style preferences) from a header avatar menu, and can **delete their account** and everything in it.
- Builds a wardrobe by **uploading clothing photos** (AI auto-tags category, colors, warmth, formality, seasons) or **searching the web** and adding real products.
- Gets a **weather- and calendar-aware "what to wear today"** outfit assembled from items they own.
- Gets **"what to buy next"** gap analysis with real shoppable links.
- Chats with **DresserAI**, a free-form styling assistant grounded in their wardrobe/weather/calendar.
- Generates **AI try-on photos** (TryOn) — their camera photo + a garment rendered into one image.
- Adds **calendar events** (interview, wedding, gym…) so that day's outfit matches the dress code.

Monetization: outfit recommendations are free/unlimited; **Buy Next, DresserAI, and TryOn are each metered** (own weekly free limit), with a **$5/month Plus plan** (Stripe) unlocking unlimited.

## Current state

**Working and verified end-to-end** (both servers running locally, driven in a real browser + full test suite):
- **Auth with email confirmation** (JWT): verify-before-use gate — register → unverified → login blocked (403) until the emailed link is clicked (which auto-logs in); resend supported. **Auto-verifies when no SMTP is configured**, so the app still runs with zero secrets.
- **Account menu** (header avatar + dropdown): plan badge, account settings (avatar upload/remove, change password, location), style-preferences customization (feeds the AI recommender), and **type-to-confirm account deletion** (hard-deletes the user + all their data).
- Wardrobe CRUD + photo upload, AI tagging, web product search + add. **Delete actions now go through a styled confirmation modal.**
- **Blob-only cursor**: the OS cursor is hidden on mouse devices so only the blob cursor shows (touch untouched).
- Today outfit (AI path, `source: "ai"`), calendar with dress-code matching, weather widget with city/map/change-location.
- DresserAI chat (replies reference real wardrobe items + weather).
- Buy Next suggestions with guaranteed Google-Shopping fallback links.
- Plan/quota tracking for all three metered features; Stripe checkout reaches hosted page in test mode.
- Client caching, skeleton loaders, optimistic UI, AI-estimated warmth (read-only).
- Claymorphic design (navy `#0B1957` / blush `#FA9EBC` / cream), Ramaraja brand font, anime.js motion, blob cursor, click spark, circular gallery, legal footer (ToS + Privacy).

**Tests:** 96 backend tests pass (`pytest -q`). Frontend `npm run build` (tsc + vite) is clean.

**Stack:** FastAPI (Python 3.9, SQLite dev) + React/Vite/TypeScript/Tailwind SPA. AI via a provider-agnostic `services/llm.py` (Anthropic *or* Google Gemini); email via a best-effort `services/email.py` (stdlib SMTP). Repo root is this `Wardrobe builder app/` directory; pushed to `github.com/AnirudIye/Wardrobe-builder-app` (private).

**Branch / PR:** the account + email + cursor + delete work lives on branch `feature/account-email-cursor-delete`, **open as [PR #1](https://github.com/AnirudIye/Wardrobe-builder-app/pull/1)** against `main` (not yet merged). `main` is still at the pre-feature commit `0efc935`. Design spec + implementation plan are in `docs/superpowers/`.

## Files (what exists / was touched)

The whole app was built in this workspace; git history (`git log --oneline`) is the authoritative change record. Key areas:

**Backend `backend/app/`**
- `services/llm.py` — single gateway for all text AI (Anthropic→Gemini fallback, placeholder-key hygiene, Gemini token/role quirks).
- `services/email.py` — **best-effort SMTP gateway** (`available`/`send`/`send_verification_email`), mirrors `llm.py`'s catch-log-degrade contract; no-ops + logs the verification link when unconfigured.
- `services/` — `vision`, `recommendation`, `trends`, `dresser_ai`, `tryon`, `shopping`, `weather`, `quota`, `billing`, `images` (incl. shared `download_image_bytes`).
- `routers/auth.py` — register (gated), login (403 until verified), **`/auth/verify`**, **`/auth/resend-verification`**, `/auth/me`.
- `routers/profile.py` — profile GET/PATCH, `/profile/location`, **`POST/DELETE /profile/avatar`**, **`POST /profile/password`**, **`DELETE /profile`** (hard-delete cascade: garments + image files, calendar events, usage rows, avatar file, then the user).
- other `routers/` — `wardrobe` (incl. `/items/{id}/retag`, `/search`, `/items/from-web`), `recommendations`, `calendar`, `dresser_ai`, `tryon`, `billing`.
- `core/security.py` — JWT access tokens + **`create_email_token`/`decode_email_token`** (purpose-scoped verify tokens).
- `models/user.py` — now includes **`email_verified`** and **`avatar_key`** (+ billing/plan fields); `garment`, `calendar_event`, `recommendation_event` (quota source of truth).
- `storage/` — `StorageBackend` ABC + `LocalStorage` (avatars stored under `avatar_<uuid>.jpg`, served at `/media`).
- `config.py` — all settings/keys incl. **SMTP (`smtp_host/port/user/password/from`, `smtp_starttls`, `email_verify_expire_minutes`)**; `main.py` — app factory + router registration.

**Frontend `frontend/src/`**
- `cache.ts` + `store.ts` — shared session cache (deduped, per-resource; `profileCache` drives the header avatar/plan).
- `pages/` — `Wardrobe`, `Today`, `BuyNext`, `Calendar`, `DresserAI`, `TryOn`, `Upgrade`, `Login` (now with a "check your email / resend" panel).
- `components/` — **`ConfirmDialog`** (reusable, with type-to-confirm), **`Modal`** (generic shell), **`AccountMenu`** (avatar + dropdown), **`AccountSettings`**, **`Customization`**, plus `Skeleton`, `WeatherWidget`, `BlobCursor` (now renders at all widths on mouse devices), `ClickSpark`, `CircularGallery`, `LegalFooter`.
- `api.ts` (typed client — adds `verifyEmail`/`resendVerification`/`uploadAvatar`/`removeAvatar`/`changePassword`/`deleteAccount`), `App.tsx` (tabs + header account menu + verify-link landing), `auth.tsx`, `date.ts`, `animations.ts`, `index.css` (clay classes + `cursor: none` on fine-pointer devices).

**Docs:** `CLAUDE.md` (architecture + conventions, current), `README.md`, `backend/.env.example`, `docs/superpowers/{specs,plans}/`.

## What notably changed / decisions made

- **Email confirmation is verify-before-use** but **degrades to auto-verify when SMTP is unconfigured** — preserving the "runs with zero secrets" principle. Transport is stdlib `smtplib` behind `services/email.py` (provider-agnostic gateway, easy to swap for a hosted API later). Verify tokens are stateless purpose-scoped JWTs; clicking the emailed link auto-logs the user in.
- **Account management via a header avatar menu**, not a full tab: settings (avatar/password/location) + customization (style preferences, which already feed the recommender) + type-to-confirm hard delete. Avatar upload reuses the existing `StorageBackend`; display name was intentionally left out of scope.
- **Cursor is blob-only on mouse devices** (`@media (pointer: fine)` hides the OS cursor; the blob renders at all widths). Touch devices are unchanged.
- **Every delete is confirmed** through one reusable `ConfirmDialog`; account deletion uses its `requireText="DELETE"` mode.
- **Multi-provider AI** (unchanged): all text AI routed through `llm.py`.
- **Calendar timezone** (unchanged): client computes its local date via `localISODate()` and passes `?date=` to `/recommendations/today`.
- **Quota** (unchanged): three independently-metered kinds (`buy-next`, `dresser-ai`, `tryon`); Today stays free.
- **Warmth is AI-estimated** (unchanged); chat/try-on are not persisted.

## What failed / known issues

1. **Prod migration MUST backfill `email_verified=true` for existing users.** `email_verified` defaults to `False` and login hard-blocks (403) any unverified user. The eventual Alembic/DDL migration that adds this column must set existing rows to `true`, or every pre-feature account is locked out on deploy. (Documented in `CLAUDE.md` → Database. The **local dev DB has already been migrated** this way — see "Running it locally".)
2. **No Alembic migrations yet.** Tables auto-create via `create_all`; a schema change in dev requires either an `ALTER TABLE` or deleting `wardrobe.db`. Must add Alembic before any real deployment.
3. **TryOn image generation is blocked by Google account quota** — code path is complete; `gemini-2.5-flash-image` returns "quota exceeded" until billing is enabled on the Google project. Text AI on the same key works fine. TryOn returns a graceful 503.
4. **SerpAPI product lookups intermittently time out** — not a code bug; buy-next degrades to the guaranteed Google-Shopping fallback link per suggestion.
5. **Secrets keep landing in `backend/.env.example`** (a tracked, public template). Real keys must go in the git-ignored `backend/.env`. Watch for it (SMTP keys were added as placeholders only).
6. **Python 3.9** is past EOL (harmless `FutureWarning`s) + a benign `bcrypt has no attribute __about__` warning. Neither affects behavior.
7. **Windows + Anaconda SSL gotcha:** venv `python`/`uvicorn`/`pip` can fail with an `_ssl` DLL error; prepend Anaconda's `Library\bin` to PATH first (documented in `CLAUDE.md`).

**Non-blocking review follow-ups** (from the final whole-branch review, optional): harden `decode_email_token`'s `int()` against a non-numeric `sub`; add a `send()`-success test stubbing `smtplib` to cover the STARTTLS/465/login branches; extract a shared async-form hook to DRY `AccountSettings`/`Customization`.

## Next steps

- **Review + merge [PR #1](https://github.com/AnirudIye/Wardrobe-builder-app/pull/1)** into `main`.
- **Add Alembic** and, when adding the `email_verified`/`avatar_key` columns to a real DB, **backfill `email_verified=true`** (see known-issue #1). Switch `DATABASE_URL` to managed Postgres before deploying.
- **Enable Google image-gen billing** to unblock TryOn (or wire an alternate provider behind `tryon.generate_tryon`).
- **Deploy:** API (Render/Fly/Railway) + SPA (Vercel/Netlify); move image storage from local disk to S3/R2 behind `StorageBackend`; set a real transactional-email provider (or SMTP) for confirmation emails; register the deployed Stripe webhook URL and set `STRIPE_WEBHOOK_SECRET`.
- **Complete a real Stripe test purchase** end-to-end (Stripe CLI forwarding webhooks to `localhost:8000/billing/webhook`).
- **Have the ToS/Privacy copy reviewed by a human** before onboarding real users.
- Consider **upgrading off Python 3.9** and adding a small frontend test suite (currently backend-only).

## Running it locally

Two terminals (both servers must run together):

```bash
# Backend  (from backend/)   — Windows/Anaconda: prepend Library\bin to PATH first
uvicorn app.main:app --reload         # :8000, docs at /docs

# Frontend (from frontend/)
npm run dev                           # :5173, proxies /api -> :8000
```

Then open http://localhost:5173. Keys go in `backend/.env` (copy from `.env.example`); the app fully runs with no keys.

- **Schema:** the local `backend/wardrobe.db` has already been migrated for the new `email_verified` + `avatar_key` columns, and the two existing accounts (`demo@wardrobe.app`, `sdasda@gmail.com`) were backfilled to verified so they can still log in. If you recreate the DB from scratch, register fresh accounts instead.
- **Email confirmation:** with no `SMTP_*` set in `backend/.env`, new signups **auto-verify** (log in immediately). To exercise the real confirmation flow, set `SMTP_HOST`/`SMTP_FROM`/`SMTP_USER`/`SMTP_PASSWORD` (a Mailtrap inbox works well); without a mail server, the verification link is printed to the uvicorn console.

See `CLAUDE.md` for architecture and conventions.
