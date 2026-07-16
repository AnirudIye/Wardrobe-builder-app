# BetterDresser — Handoff

_Last updated: 2026-07-16_

## Goal

BetterDresser is a portfolio-grade web app for managing a digital wardrobe and getting AI styling help. A logged-in user signs up (with email confirmation), builds a wardrobe by uploading clothing photos (AI auto-tags) or adding real products from the web, then gets weather- and calendar-aware "what to wear today" outfits, "what to buy next" gap analysis with real shoppable links, free-form styling chat (DresserAI), AI try-on photos (TryOn), and account management. A public marketing landing page greets logged-out visitors. Monetization: outfits free/unlimited; Buy Next, DresserAI and TryOn metered weekly with a $5/mo Plus plan (Stripe).

**Stack:** FastAPI (Python 3.9, SQLite dev) + React/Vite/TS/Tailwind SPA. Text AI via `services/llm.py` (Anthropic or Gemini); email via `services/email.py` (stdlib SMTP). Repo root is `Wardrobe builder app/`; remote `github.com/AnirudIye/Wardrobe-builder-app` (private).

## Current state

**Branch `feature/landing-motion` (all work committed, tree clean), 12 commits ahead of local `main`.** `main` is still at `fa042c0` and has NOT been pushed to origin (origin/main is one further behind at `bc6e524`). Backend: **96 tests pass**; frontend `npm run build` clean.

Committed on the branch this session:
- **Landing redesign checkpoint** (prior session's illustrations/blobs/dash-free copy) + design spec + implementation plan (`docs/superpowers/`).
- **Landing motion system:** testimonials + emoji glyphs removed (💨→SVG in WeatherWidget, ✦→SVG diamond); seamless `Marquee` component (measures a set, duplicates to overflow, shifts exactly one set-width — provably seamless, replacing the CSS marquee that gapped on wide viewports); `useReveal` scroll reveals; `CountUp` stats; `HeroField` canvas particle field; `SplitText` headline; cursor parallax + `.text-gradient-pan` accent + hover polish. All gated on `prefers-reduced-motion` and fail open (nothing stays hidden if IO/rAF never run).
- **TryOn camera fix:** the `<video>` was only mounted after `streamActive`, so the stream attached to a null ref — preview stayed blank and Capture was a silent no-op. Video now stays mounted (hidden), streams stop on failure, capture errors surface.
- **Buy Next picks in TryOn:** shared `fetchBuyNext()` (cache + in-flight dedupe) and an explicit "Load Buy Next picks" button in TryOn (explicit because a run costs a weekly credit).
- **`ErrorNote` component:** on-brand blush clay error note (SVG icon, role=alert) replacing bare red text at all 15 error sites. Red kept intentionally on delete-account affordances (danger cue for actions, not messages).

**Email confirmation WORKS end-to-end** (register → email → click → verified → login), verified live today including the DB flip. Transport is **Gmail SMTP with an App Password** from the dedicated account `BetterDresserConfirmation@gmail.com` (values in `backend/.env`, git-ignored). History: Brevo was tried first and abandoned — its free tier accepts SMTP sends then rejects them internally ("sender not valid") unless the From is a validated sender, its sender-confirmation email never arrived, and Gmail throttles its shared pool (421) anyway. **The Brevo SMTP key + API key were pasted in chat and should be revoked in the Brevo dashboard; they're no longer used.**

## Known issues / limitations

1. **TryOn generation is paid-only at Google.** Probed every image model the key exposes (2.5-flash-image, 3.1-flash/-lite, 3-pro): all return free-tier `RESOURCE_EXHAUSTED` with `limit: 0` — image generation has NO free tier, on any account. Enabling billing (~$0.03–0.04/image) unlocks it with zero code changes; consider switching `GOOGLE_IMAGE_MODEL` to a cheaper 3.1-lite model then (re-probe first). User chose to leave it; the app 503s gracefully and doesn't burn weekly quota on failures.
2. **Landing motion not eyeballed.** Structure/geometry/logic verified programmatically; the harness browser pane is a hidden page (no rAF/IO/paint → no screenshots), so actual animation playback needs a human look at http://localhost:5173 logged out.
3. Stat-card blobs may still read as ellipses (subjective; dial to `.blob-card-*` if disliked).
4. Pre-existing: no Alembic (prod migration must backfill `email_verified=true` for existing users — see CLAUDE.md); Python 3.9 EOL warnings; benign passlib/bcrypt `__about__` traceback in logs; Windows+Anaconda `_ssl` PATH gotcha.

## Next steps

1. **Eyeball the landing motion** in a real browser (marquee loop, count-up, hero field, split headline, parallax) and tweak taste items.
2. **Merge `feature/landing-motion`** (or PR it) once the visuals pass, then **push `main`**.
3. **Revoke the Brevo keys** (dashboard → SMTP & API) — exposed in chat, unused now.
4. Optional: enable Google billing for TryOn; soften stat blobs; real product photos in the hero.

## Running it locally

Two terminals (both must run together). Windows/Anaconda: prepend Anaconda's `Library\bin` to PATH first or the venv fails with an `_ssl` DLL error.

```bash
# Backend (from backend/)
export PATH="/c/Users/<you>/anaconda3:/c/Users/<you>/anaconda3/Library/bin:/c/Users/<you>/anaconda3/Scripts:$PATH"
.venv/Scripts/python -m uvicorn app.main:app --reload   # :8000, docs at /docs

# Frontend (from frontend/)
npm run dev                                              # :5173, proxies /api -> :8000
```

Open http://localhost:5173. Dev DB has 3 real accounts (all verified). With SMTP configured in `.env` (it is), new signups require email confirmation; wiping the SMTP_* values reverts to auto-verify. See `CLAUDE.md` for architecture and conventions.
