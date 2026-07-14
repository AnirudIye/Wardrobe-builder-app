# BetterDresser

A portfolio-grade web app: log in, build a digital wardrobe by uploading photos of
your clothes (auto-tagged by Claude vision), then get **weather-aware outfit
recommendations** and **buy-next suggestions with real shoppable links**. Add events
to your **calendar** (interview, wedding, gym…) and that day's outfit matches the
dress code. Outfit recommendations are free and unlimited; buy-next suggestions are
capped at 5/week on the free tier — a $5/month plan unlocks unlimited (Stripe).

- **Backend:** Python / FastAPI + SQLAlchemy (SQLite dev, Postgres-ready). See [backend/README.md](backend/README.md).
- **Frontend:** React + Vite + TypeScript + Tailwind. See [frontend/README.md](frontend/README.md).

## Architecture

```
React SPA  ──/api (Vite proxy)──▶  FastAPI
                                     ├─ auth        JWT (register/login/me)
                                     ├─ profile     location + style prefs, /weather, /trends
                                     ├─ wardrobe    photo upload → AI tags → CRUD
                                     ├─ calendar    events with dress codes → outfit matching
                                     ├─ recommendations  /today, /buy-next  (quota-guarded)
                                     ├─ billing     Stripe checkout / portal / webhook, /status
                                     └─ services/   vision, weather, trends, recommendation,
                                                    shopping, quota, billing
```

Every external service (Claude, OpenWeather, SerpAPI, Stripe) is **best-effort**:
without a key, the app still runs — AI tagging returns empty tags, recommendations
fall back to a deterministic heuristic, weather/shopping return nothing, and billing
endpoints return 503. This makes the app demoable with zero secrets.

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv && . .venv/Scripts/activate        # or source .venv/bin/activate
pip install --only-binary :all: -r requirements.txt
cp .env.example .env                                     # fill in keys (all optional for a basic demo)
uvicorn app.main:app --reload                            # http://localhost:8000/docs

# 2. Frontend (needs Node 18+)
cd ../frontend
npm install
npm run dev                                              # http://localhost:5173
```

## Configuration

All secrets live in `backend/.env` (git-ignored; see `backend/.env.example`):

| Key | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | AI photo tagging, outfit + buy-next reasoning, trends (model: `claude-haiku-4-5`) |
| `OPENWEATHER_API_KEY` | Weather-aware outfit recommendations |
| `SERPAPI_KEY` | Real shoppable product links in buy-next |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | $5/mo subscription |
| `JWT_SECRET` | Auth token signing (set a long random value) |

## Plans & quota

- **Today outfits: free and unlimited** — never paywalled.
- Free: **5 buy-next suggestions / trailing 7 days**; the 6th returns **HTTP 402** and
  the UI routes to the upgrade screen. The quota is checked **before** any paid API call.
- Paid ($5/mo): unlimited buy-next. Plan state is driven by **Stripe webhooks**, which
  flip the user between `free` and `paid` on subscribe / renew / cancel.
- Usage is tracked per `RecommendationEvent` row; only `kind="buy-next"` rows count
  toward the quota.

## Testing

```bash
cd backend && pytest -q      # 49 tests: auth, wardrobe, vision, weather, recs, trends/shopping, quota+billing, calendar
```

## Deployment (outline)

- **API:** Render / Fly.io / Railway. Switch `DATABASE_URL` to managed Postgres and add
  Alembic migrations. Move image storage to S3/R2 behind the existing `StorageBackend`.
- **SPA:** Vercel / Netlify. Point the API base at the deployed backend and update CORS
  (`FRONTEND_BASE_URL`).
- **Stripe:** create the product + $5/mo price in the dashboard, then register the
  deployed `/billing/webhook` URL and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

> Account/key setup in the Stripe, OpenWeather, SerpAPI, and Anthropic dashboards is a
> manual step you perform yourself — the code is wired to consume those keys once present.
