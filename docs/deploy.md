# Deploying BetterDresser securely

The codebase is deploy-ready but deliberately platform-agnostic. This is the
checklist to run through when a host is chosen. "Frontend encryption" =
HTTPS/TLS, and it happens **here**, not in application code.

## 1. TLS / HTTPS (the actual encryption)

- Let the platform terminate TLS (Render/Railway/Fly/Vercel all issue
  Let's Encrypt certs automatically; on a VPS, nginx/caddy + certbot).
- Do NOT add an HTTPS-redirect in the app — the platform/proxy owns that.
- Set `ENVIRONMENT=production`: the API then sends
  `Strict-Transport-Security` (HSTS) so browsers refuse downgrades.
- Run uvicorn behind the proxy with `--proxy-headers
  --forwarded-allow-ips='*'` (or the platform equivalent) so rate limiting
  sees real client IPs instead of the proxy's.

## 2. Environment (all set as platform env vars, never files)

| Key | Production value |
| --- | --- |
| `ENVIRONMENT` | `production` (startup fails fast on weak config) |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `JWT_EXPIRE_MINUTES` | `4320` (3 days) |
| `CORS_ORIGINS` | exact frontend origin(s), e.g. `https://app.example.com` |
| `DATABASE_URL` | managed Postgres (`postgresql+psycopg://...?sslmode=require`) |
| `STORAGE_BACKEND` + `S3_*` | R2/S3 bucket (free-tier host disks are ephemeral) |
| `FRONTEND_BASE_URL` | the deployed frontend URL (Stripe redirects, verify links) |

Rotate any secret that was ever pasted into a chat, commit, or ticket.

## 3. Database (release phase)

- Schema is applied by `alembic upgrade head` as an explicit release step —
  the app does NOT create tables in production.
- Adopting a pre-Alembic database: `alembic stamp head`, and if it predates
  email confirmation run `UPDATE users SET email_verified = true` first (see
  the baseline migration's docstring).

## 4. Frontend

- `npm run build` output (`dist/`) already contains the CSP meta tag.
- When the static host supports response headers, move the same policy from
  the meta tag to a real `Content-Security-Policy` header and add
  `frame-ancestors 'none'` (meta CSP cannot express it).
- The SPA calls `/api/*` relative: either serve the SPA from the API service,
  or configure the static host to rewrite/proxy `/api/*` to the API origin.

## 5. Already handled in code (nothing to do, just don't undo it)

- Security headers on every API response; docs endpoints disabled in prod.
- Auth endpoints rate-limited per IP (in-process — if you scale past one
  worker, swap the backend for Redis before trusting the exact limits).
- Remote image fetches are SSRF-guarded (public-IP-only, per redirect hop).
- Stripe webhooks are signature-verified; media keys are unguessable uuid4.
