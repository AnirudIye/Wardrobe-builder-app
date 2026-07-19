# BetterDresser

A portfolio-grade web app: log in, build a digital wardrobe by uploading photos of
your clothes (auto-tagged by Claude vision), then get **weather-aware outfit
recommendations** and **buy-next suggestions with real shoppable links**. Add events
to your **calendar** (interview, wedding, gym…) and that day's outfit matches the
dress code. Ask **DresserAI** free-form styling questions, or use **TryOn** to see
yourself wearing a piece via your camera and AI image generation. Outfit
recommendations are free and unlimited; buy-next suggestions, DresserAI chat, and
TryOn each have their own free weekly allowance - a $5/month plan unlocks unlimited
access to all three (Stripe).

- **Backend:** Python / FastAPI + SQLAlchemy (SQLite dev, Postgres-ready). See [backend/README.md](backend/README.md).
- **Frontend:** React + Vite + TypeScript + Tailwind. See [frontend/README.md](frontend/README.md).

## Architecture

```
React SPA  ──/api (Vite proxy)──▶  FastAPI
                                     ├─ auth        JWT (register/login/me)
                                     ├─ profile     location (+ /profile/location geocode), /weather, /trends
                                     ├─ wardrobe    photo upload → AI tags → CRUD
                                     ├─ calendar    events with dress codes → outfit matching
                                     ├─ recommendations  /today (free), /buy-next  (quota-guarded)
                                     ├─ dresser-ai  /chat - stateless multi-turn styling chat (quota-guarded)
                                     ├─ tryon       /tryon - camera photo + garment → AI try-on image (quota-guarded)
                                     ├─ billing     Stripe checkout / portal / webhook, /status
                                     └─ services/   vision, weather, trends, recommendation,
                                                    shopping, quota, billing, dresser_ai, tryon
```

Every external service (Claude, OpenWeather, SerpAPI, Stripe, Gemini) is
**best-effort**: without a key, the app still runs - AI tagging returns empty tags,
recommendations fall back to a deterministic heuristic, weather/shopping return
nothing, DresserAI replies with a friendly fallback message, TryOn returns a 503, and
billing endpoints return 503. This makes the app demoable with zero secrets.

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
| `ANTHROPIC_API_KEY` **or** `GOOGLE_API_KEY` | All text AI: photo tagging, outfit + buy-next reasoning, trends, DresserAI chat. Either provider works (Anthropic preferred when both are set); models: `claude-haiku-4-5` / `gemini-flash-lite-latest` |
| `OPENWEATHER_API_KEY` | Weather-aware outfit recommendations, city geocoding |
| `SERPAPI_KEY` | Real shoppable product links in buy-next |
| `GOOGLE_API_KEY` | Also powers TryOn image generation (`gemini-2.5-flash-image`; needs image-gen quota/billing on the Google account). Get a key at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | $5/mo subscription |
| `JWT_SECRET` | Auth token signing (set a long random value) |

## Plans & quota

- **Today outfits: free and unlimited** - never paywalled.
- Free tier: **5 buy-next suggestions**, **20 DresserAI messages**, and **5 try-ons**
  per trailing 7 days - each its own independent allowance. Exceeding one returns
  **HTTP 402** and the UI routes to the upgrade screen; the quota is checked **before**
  any paid API call, and a failed TryOn generation doesn't consume the allowance.
- Paid ($5/mo): unlimited on all three. Plan state is driven by **Stripe webhooks**,
  which flip the user between `free` and `paid` on subscribe / renew / cancel.
- Usage is tracked per `RecommendationEvent` row, keyed by `kind`
  (`"buy-next"` / `"dresser-ai"` / `"tryon"`) - `"today"` rows are logged but never
  counted. DresserAI chat history itself is **not persisted**; only the fact that a
  message was sent is recorded, for quota purposes.

## Testing

```bash
cd backend && pytest -q      # 74 tests: auth, wardrobe, vision, weather, recs, trends/shopping,
                              # quota+billing, calendar, dresser-ai, tryon
```

## Deployment (outline)

- **API:** Render / Fly.io / Railway. Switch `DATABASE_URL` to managed Postgres and add
  Alembic migrations. Move image storage to S3/R2 behind the existing `StorageBackend`.
- **SPA:** Vercel / Netlify. Point the API base at the deployed backend and update CORS
  (`FRONTEND_BASE_URL`).
- **Stripe:** create the product + $5/mo price in the dashboard, then register the
  deployed `/billing/webhook` URL and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

> Account/key setup in the Stripe, OpenWeather, SerpAPI, and Anthropic dashboards is a
> manual step you perform yourself - the code is wired to consume those keys once present.
