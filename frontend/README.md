# Wardrobe Builder - Frontend (React + Vite + TS + Tailwind)

Single-page app for the Wardrobe Builder: auth, wardrobe grid + photo upload,
today's outfit, buy-next suggestions, and plan/upgrade.

## Requirements

- **Node.js 18+** and npm (not installed in the original dev environment - install
  from https://nodejs.org before running).

## Setup & run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to the FastAPI backend at `http://localhost:8000`
(see `vite.config.ts`), so start the backend first (`uvicorn app.main:app --reload`
in `../backend`). No CORS setup is needed because the browser talks to the Vite
origin and the proxy forwards to the API.

## Build

```bash
npm run build      # type-checks then outputs static files to dist/
npm run preview    # serve the production build locally
```

## Structure

```
src/
  api.ts           # typed fetch client (JWT from localStorage, /api prefix)
  auth.tsx         # AuthProvider + useAuth (login/register/logout)
  App.tsx          # shell: login gate + tab navigation
  pages/
    Login.tsx      # sign in / register
    Wardrobe.tsx   # upload + grid + inline tag editing
    Today.tsx      # weather-aware outfit; 402 → routes to Plan
    BuyNext.tsx    # gap suggestions with real product links; 402 → Plan
    Upgrade.tsx    # plan status + Stripe checkout / customer portal
```

> Note: this frontend was written without a local Node toolchain available, so it
> has not been run or type-checked in-environment. `npm install` then `npm run dev`
> to verify; fix any type errors the first `npm run build` surfaces.
