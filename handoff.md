# BetterDresser — Handoff

_Last updated: 2026-07-15_

## Goal

BetterDresser is a portfolio-grade web app for managing a digital wardrobe and getting AI styling help. A logged-in user signs up (with email confirmation), builds a wardrobe by uploading clothing photos (AI auto-tags) or adding real products from the web, then gets weather- and calendar-aware "what to wear today" outfits, "what to buy next" gap analysis with real shoppable links, free-form styling chat (DresserAI), AI try-on photos (TryOn), and account management (avatar, password, style preferences, deletion). A public **marketing landing page** greets logged-out visitors.

Monetization: outfit recommendations are free/unlimited; Buy Next, DresserAI and TryOn are each metered (weekly free limit), with a $5/month Plus plan (Stripe) unlocking unlimited.

**Stack:** FastAPI (Python 3.9, SQLite dev) + React/Vite/TypeScript/Tailwind SPA. Text AI via provider-agnostic `services/llm.py` (Anthropic or Gemini); email via best-effort `services/email.py` (stdlib SMTP). Repo root is `Wardrobe builder app/`; remote `github.com/AnirudIye/Wardrobe-builder-app` (private).

## Current state

**On `main` and working end-to-end** (verified earlier this session in a real browser): auth + email confirmation, wardrobe CRUD + AI tagging, web product search/add, Today outfit, calendar, weather, DresserAI, Buy Next, TryOn (code-complete; blocked only by Google image quota), Plan/quota, Stripe checkout, blob cursor, click spark, delete-confirmation modals, account avatar/dropdown menu, and a **marketing landing page** for logged-out visitors.

- Backend: **96 tests pass** (`pytest -q`). Frontend `npm run build` was clean as of the last successful run.
- Git: `main` is at commit `fa042c0` (landing-page scaffold, merged from `feature/landing-page`). **`main` has NOT been pushed to `origin` since that merge** — `origin/main` is one commit behind at `bc6e524` (the PR #1 merge).

**In progress / UNCOMMITTED (this session's landing redesign):** the landing page was restyled per request — em-dashes removed, organic blob shapes, and every emoji/icon replaced with flat SVG illustrations. These changes are **only in the working tree, not committed**, and the last change (a blob-clipping fix) is **not yet re-verified by a build or browser preview** (a classifier outage blocked the rebuild).

**Dev servers are DOWN.** The backgrounded `uvicorn` (:8000) and `vite` (:5173) both exited (code 4) and need restarting before you can test on localhost.

## Files touched (this session)

**Landing page — created:**
- `frontend/src/pages/Landing.tsx` — the full landing page (nav, hero with floating outfit card, marquee, stats, feature grid, how-it-works, app-window showcase, Free/Plus pricing, testimonials, gradient CTA, footer). Committed in `fa042c0`, then heavily rewritten (uncommitted) to use illustrations + blobs + dash-free copy.
- `frontend/src/components/illustrations.tsx` *(uncommitted, new)* — flat vector illustration set: garments (`Tee`, `Coat`, `Jeans`, `Sneaker`, `Derby`, `Belt`), weather (`SunCloud`), concepts (`Wardrobe`, `Bag`, `Chat`, `Mirror`, `Calendar`), steps (`Camera`, `Pin`, `Sparkles`, `Bags`), and `Avatar`. Each actually depicts the thing (no emoji/network assets).

**Modified:**
- `frontend/src/App.tsx` — renders `Landing` as the default logged-out view with an `authView` "landing" | "login" switch (verify-link visitors go straight to auth); em-dash removed. (Landing wiring committed in `fa042c0`; nothing new uncommitted here beyond the em-dash edit.)
- `frontend/src/pages/Login.tsx` — added an optional `onBack` prop + "back to home" links (committed `fa042c0`); em-dash removed (uncommitted).
- `frontend/src/index.css` — added landing motion/texture keyframes (`floaty`, `blobmorph`, `gradient-pan`, `marquee`, grain) committed in `fa042c0`; then added **blob shape classes** `.blob-a..d`, `.blob-pill`, `.blob-card-a..d` (uncommitted).
- **Em-dash removal (uncommitted, visible copy only):** `components/AccountMenu.tsx`, `components/LegalFooter.tsx`, `pages/Wardrobe.tsx`, `pages/DresserAI.tsx`, `pages/Upgrade.tsx`, `pages/TryOn.tsx`, `pages/Calendar.tsx`. (Code comments still contain em-dashes; only user-facing strings were changed.)

## What changed / decisions

- **Landing integration:** logged-out visitors see the landing by default; any CTA (`onGetStarted`) flips `authView` to the auth screen (which gained a back-to-home link). Refresh always returns to the landing. The email verify-link flow still lands on auth directly.
- **Illustrations, not emoji/icons:** since real product photography can't be sourced/fetched (and external hotlinks are fragile), garments/weather/concepts are drawn as self-contained flat SVG in `illustrations.tsx`. Swap in real photos later by dropping files in `frontend/public/`.
- **Blob shapes, two tiers:** small square-ish elements (icon tiles, thumbnails, stat cards, chips) use strong percentage-radius blobs (`.blob-a..d`, `.blob-pill`); large content cards use gentler fixed-rem "card blobs" (`.blob-card-a..d`) so text never clips. Blobs are scoped to the **landing only** — the logged-in app keeps its normal rounded clay.
- **Em-dashes:** replaced with commas / periods / colons in all visible copy.

## What failed / known issues

1. **Blob-card fix is unverified.** The strong blobs initially clipped the Plus pricing card's checklist (blob radius + `overflow-hidden`). Fixed by introducing `.blob-card-*` and swapping all large cards to them — but the rebuild/preview to confirm was **blocked by a temporary classifier outage**, so this has NOT been visually re-checked. First thing next session: rebuild + eyeball the pricing/stat/nav sections.
2. **Stat cards read as flat ellipses** and the nav/full-width buttons were tuned (nav → `blob-card-a`, full-width pricing buttons → `rounded-full`). The stat-card ellipses may still feel too strong — dial back to `.blob-card-*` if so.
3. **Couldn't access the user's reference design** (`claude.ai/design/...`): WebFetch 403, the Claude-in-Chrome extension wasn't connected, and the in-app browser hit the claude.ai sign-in wall. The landing was built to match the app + a standard structure, not the linked design. Get a screenshot to align specifics.
4. **Dev servers exited (code 4)** and must be restarted (see "Running it locally").
5. **Landing redesign is uncommitted** and `main` is unpushed — see "Next steps".
6. Pre-existing (unchanged this session): TryOn blocked by Google image-gen quota; no Alembic (schema changes need `ALTER`/DB reset — and the prod migration adding `email_verified` MUST backfill existing users to `true`, see `CLAUDE.md`); Python 3.9 EOL warnings; Windows+Anaconda `_ssl` PATH gotcha.

## Next steps

1. **Restart servers, rebuild, and verify the blob fix.** From `frontend/`: `npm run build` (must be clean), then run both servers (below) and open http://localhost:5173 logged out to check the Plus pricing card no longer clips, and that stat cards / nav / buttons look right.
2. **Commit the landing redesign.** It's currently uncommitted on `main`; branch first (e.g. `feature/landing-illustrations`), commit `illustrations.tsx` + the Landing/index.css/em-dash edits, then merge/PR.
3. **Push `main` to `origin`** — it's one commit ahead (`fa042c0`) and unpushed.
4. **Align to the reference design** if desired — ask the user for a screenshot of the linked `AI Dressing Landing Page` design.
5. Optional: real product **photos** in the hero/showcase; soften the stat-card blobs; sweep code **comments** for em-dashes if "remove all em-dashes" was meant literally everywhere.

## Running it locally

Two terminals (both must run together). Windows/Anaconda: prepend Anaconda's `Library\bin` to PATH first or the venv fails with an `_ssl` DLL error.

```bash
# Backend (from backend/)
export PATH="/c/Users/<you>/anaconda3:/c/Users/<you>/anaconda3/Library/bin:/c/Users/<you>/anaconda3/Scripts:$PATH"
.venv/Scripts/python -m uvicorn app.main:app --reload   # :8000, docs at /docs

# Frontend (from frontend/)
npm run dev                                              # :5173, proxies /api -> :8000
```

Then open http://localhost:5173. The local dev DB is already migrated for the `email_verified` + `avatar_key` columns, with the two existing accounts backfilled to verified. With no `SMTP_*` in `backend/.env`, new signups auto-verify. See `CLAUDE.md` for architecture and conventions.
