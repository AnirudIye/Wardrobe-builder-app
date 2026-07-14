# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BetterDresser (formerly Wardrobe Builder) — a web app to catalogue clothes (photos auto-tagged by Claude vision, or added via web product search), then get weather- and calendar-aware outfit recommendations, "buy-next" shopping suggestions, free-form styling chat (DresserAI), and AI-generated try-on photos (TryOn). FastAPI backend + React/Vite/TS/Tailwind SPA. The git repo root is this `Wardrobe builder app/` directory (note the parent `Wardrobe builder/` folder is not the repo).

## Commands

**Backend** (from `backend/`):
```bash
python -m venv .venv && .venv\Scripts\activate      # or: source .venv/bin/activate
pip install --only-binary :all: -r requirements.txt  # prebuilt wheels only, no compiler
uvicorn app.main:app --reload                        # http://localhost:8000/docs
pytest -q                                            # full suite (~74 tests)
pytest tests/test_calendar.py::test_event_crud       # single test
```

**Frontend** (from `frontend/`, needs Node 18+):
```bash
npm install
npm run dev            # http://localhost:5173, proxies /api -> :8000
npm run build          # tsc + vite build
```

**Windows + Anaconda gotcha (important):** if `pip`/`python`/`uvicorn` in the venv fails with an SSL/`_ssl` DLL error, prepend Anaconda's DLL dir to PATH before running, e.g. in PowerShell:
`$env:Path = "C:\Users\<you>\anaconda3;C:\Users\<you>\anaconda3\Library\bin;C:\Users\<you>\anaconda3\Scripts;" + $env:Path`. The venv doesn't copy the OpenSSL DLLs that `ssl` needs.

## Architecture

Request path: **React SPA → `/api` (Vite proxy) → FastAPI routers → `app/services/*` → external APIs / DB.** Routers are thin; all real logic lives in the service layer.

**Backend structure** (`backend/app/`): `config.py` (env settings), `database.py` (engine/`SessionLocal`/`Base`/`get_db`), `core/` (`security.py` JWT+hashing, `deps.py` `get_current_user`), `models/` (SQLAlchemy 2.0 typed), `schemas/` (Pydantic), `routers/` (auth, profile, wardrobe, calendar, recommendations, dresser_ai, tryon, billing), `services/`, `storage/`.

### Three patterns that span multiple files — internalize these before editing:

1. **Every external service is best-effort and never raises to the caller.** Without an API key configured, the app still fully runs: `vision.auto_tag` returns empty `GarmentTags()`, `recommendation.recommend_outfit` falls back to a deterministic **heuristic** (`source: "heuristic"` vs `"ai"`), `weather`/`shopping` return `None`/`[]`, `trends` returns `None`, `dresser_ai.chat_reply` returns `None` (router substitutes `dresser_ai.FALLBACK_REPLY`), `tryon.generate_tryon` returns `None` (router responds 503), and billing endpoints 503. When adding a service, preserve this: catch failures, log, and degrade — do not propagate to the HTTP layer. This is what makes the app demoable with zero secrets.

2. **Quota flow is generalized across three independently-metered kinds.** `/recommendations/today` is free and unlimited (never add `quota.enforce` to it) — everything else is metered: `"buy-next"`, `"dresser-ai"`, and `"tryon"`, each with its own weekly limit (`settings.free_weekly_recommendation_limit` / `free_weekly_chat_limit` / `free_weekly_tryon_limit`). Call `quota.enforce(db, user, kind, limit)` **before any paid API call** (raises HTTP 402 for free users over that kind's limit → the SPA routes to the upgrade screen), then `quota.record(db, user, kind)` **after** successfully serving — a failed AI call (e.g. TryOn generation returning `None`) must NOT call `record`, since the user got nothing for it. Usage = count of `RecommendationEvent` rows with that `kind` in a trailing 7-day window; the table is the single source of truth (no counter column). `User.is_paid` (property: `plan == "paid"`) bypasses every kind. `BillingStatus` (`routers/billing.py`) reports remaining/limit per kind — adding a fourth metered feature means adding its own limit setting, its own `quota.remaining(...)` call in `billing_status`, and its own `BillingStatus` fields (additive, non-breaking). See `services/quota.py` and `routers/recommendations.py`/`dresser_ai.py`/`tryon.py`.

3. **Plan state is owned by Stripe, mirrored locally.** `billing` webhooks (signature-verified) flip `User.plan`/`subscription_status`/`current_period_end` on subscribe/renew/cancel. Don't set `plan` directly elsewhere — let the webhook be authoritative.

### Recommendation engine (`services/recommendation.py`)
Garments and calendar events share a `_FORMALITY_RANK` scale (athletic→casual→smart-casual→business→formal). `/recommendations/today` loads **today's** calendar events and biases picks toward the dressiest one's `event_type`; both the AI prompt and the heuristic honor this. Outfits are always assembled from the user's **owned garment IDs** only.

**Client-local date, not server date.** `/recommendations/today` and `/calendar` both need to agree on "what day is it," and the server's own clock is wrong for anyone in a different timezone. The frontend computes "today" via `frontend/src/date.ts`'s `localISODate()` (never `Date.toISOString()`, which is UTC and silently shifts the day) and passes it as `?date=` to `/recommendations/today`; the backend uses that value if present, else falls back to `date_type.today()`. Any new day-based feature should follow the same client-supplies-its-local-date pattern rather than trusting the server clock.

### DresserAI chat (`services/dresser_ai.py`, `routers/dresser_ai.py`)
Stateless multi-turn chat — the backend **never persists messages**. The client holds the full transcript (module-level `cached` array in `frontend/src/pages/DresserAI.tsx`, same survives-tab-switch-clears-on-refresh pattern as `Today.tsx`/`BuyNext.tsx`) and resends it whole on every turn; `POST /dresser-ai/chat` passes it straight to `messages.create(system=..., messages=...)`, with wardrobe/weather/today's-events context injected via the `system` prompt (built by `_system_prompt`, reusing `recommendation._garment_summary`/`_events_text`). If the AI call fails, the router substitutes `dresser_ai.FALLBACK_REPLY` rather than erroring — chat should never hard-fail.

### TryOn (`services/tryon.py`, `routers/tryon.py`)
`POST /tryon` takes a multipart photo plus **either** `garment_id` (an owned wardrobe item — ownership checked via `wardrobe._get_owned_garment`) **or** `image_url` (an external product image, e.g. a Buy Next thumbnail). Both paths end up as bytes via `images.download_image_bytes` (shared with `wardrobe.py`'s "add from web" — extracted there to avoid duplicating the size-capped download logic) and are sent to Gemini (`tryon.generate_tryon`, model `settings.google_image_model`) alongside the user's photo. Nothing is persisted — the result comes back as `image_base64` in the JSON response and is rendered directly via a `data:image/png;base64,...` URI on the frontend. A failed generation (no key / API error) returns HTTP 503 and does **not** consume the user's weekly quota (see quota pattern #2 above) — only a successful try-on counts.

### Location & weather
Users set their location by city name: `POST /profile/location` geocodes via OpenWeather's geo API (`weather.geocode`) and stores the resolved `city`/`lat`/`lon` on the User. `GET /weather` returns current conditions for the saved (or query-string) coordinates, cached ~30 min per location. The Wardrobe page's `WeatherWidget` shows city + conditions + an OpenStreetMap iframe and drives the change-location flow.

### Storage abstraction (`storage/`)
Garment images go through the `StorageBackend` ABC (`save`/`url`/`delete` keyed by opaque relative keys). Dev uses `local.py` (filesystem, served at `/media`). Swap in S3/R2 by implementing the interface — callers store only the key.

### Database
Dev is SQLite; tables auto-create on startup via `Base.metadata.create_all` (no migration step). **Alembic is not yet wired** — models are Postgres-compatible, so any schema change currently requires deleting `wardrobe.db` in dev (or adding Alembic before prod). Tests use in-memory SQLite per test.

### Frontend
Single-page app with tab state in `App.tsx` (no router). `src/api.ts` is a thin typed client: all calls hit `/api*`, the JWT lives in `localStorage` (`wb_token`) and is auto-attached, and non-2xx responses throw `ApiError` (a `402` is how the UI knows to show the upgrade flow). Keep request/response TypeScript types in `api.ts` in sync with the backend Pydantic schemas.

## Config

Secrets live in `backend/.env` (git-ignored; template in `.env.example`). All keys are optional — each unlocks one feature: `ANTHROPIC_API_KEY` (vision tagging + AI reasoning + DresserAI chat, model `claude-haiku-4-5`), `OPENWEATHER_API_KEY` (weather + geocoding), `SERPAPI_KEY`, `GOOGLE_API_KEY` (TryOn, model `gemini-2.5-flash-image`), `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET`, and `JWT_SECRET`.
