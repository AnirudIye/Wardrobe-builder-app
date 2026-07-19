# Fit Streak - Design

_Date: 2026-07-18. Status: approved, implementing this session._

## Goal

Give BetterDresser a competitive stat in the Wordle/Strava mold: a number users fully
control, can improve through daily effort, and can compare with friends. The headline
stat is a **daily outfit-log streak** (log what you actually wore; consecutive days
build the streak), backed by a deterministic 0-100 **closet score** as the secondary
stat. Comparison happens through a **shareable card** (client-rendered PNG plus a
copyable emoji grid) posted wherever friends already are, plus an anonymous percentile
line. No social graph, no usernames, no in-app leaderboard.

Decisions made with the user: streak primary + closet score secondary; share-card-only
comparison; the daily action is logging worn garments (one tap when it was the
recommendation); fuller first release (weekly points, percentile, grace rules from
day one). Logging is free - `services/quota.py` is only for paid AI calls, and this
feature makes zero AI calls.

## Data

New table `outfit_logs` (`models/outfit_log.py`, Alembic revision on `a41f08d2c7be`):

- `id`, `user_id` (FK users.id, CASCADE), `date` (SQL `Date`, the client-local day),
  `garment_ids` (JSON list of owned garment ids), `source`
  (`"recommendation" | "manual"`), `created_at`.
- `UniqueConstraint(user_id, date)` - one log per day, re-logging replaces it.
  Composite index `(user_id, date)`.

The client-supplies-local-date pattern (`localISODate()` + `?date=`/body field, as in
`/recommendations/today`) is the source of "what day is it" everywhere. UTC
`created_at` is never used for day math.

## Streak rules (`services/streaks.py`, pure functions over `set[date]`)

- **Current streak**: if today is not logged, start the backward walk at yesterday (an
  unlogged today never breaks the streak - the day is not over). Walking backward, a
  logged day adds 1; a missed day is forgiven if it is the first miss in its ISO week
  (Mon-Sun) seen during the walk, otherwise the streak ends. Forgiven days add 0.
  This is the grace rule: one automatic "rest day" per calendar week.
- **Longest streak**: single chronological pass applying the same rule.
- **Weekly style points**: `10 * days_logged_this_ISO_week +
  min(2 * distinct_garment_ids_this_week, 30)`.
- **Backfill grace**: `POST /fits/log` accepts `date` of client-today or
  client-yesterday only (400 otherwise). The client also sends its `today`;
  the server sanity-checks it against `[server_utc_date - 2, server_utc_date + 1]`,
  which covers UTC-12 through UTC+14.

## Closet score (`services/closet_score.py`, pure function over garments)

0-100, additive: category coverage 40 (8 per essential slot owned among top / bottom /
shoes / outerwear / dress), formality spread 30 (6 per `_FORMALITY_RANK` tier present),
season coverage 20 (5 per season present), depth 10 (`min(items, 20) / 20 * 10`).
Untagged garments count toward depth only (retag backfills nulls automatically).

## API (`routers/fits.py`, `schemas/fits.py`)

- `POST /fits/log` `{date, today, garment_ids, source}`: every garment id must be owned
  (404 otherwise, same pattern as `wardrobe._get_owned_garment`), at least one id,
  grace-window validation as above, upsert on `(user_id, date)`. Returns the full
  status payload so the UI refreshes in one round trip.
- `GET /fits/status?date=YYYY-MM-DD`: `{today_logged, today_source, current_streak,
  longest_streak, week (7 Mon-Sun entries: date/logged/source), week_points,
  closet_score, percentile, total_logs}`.
- **Percentile**: one `GROUP BY user_id` count over `outfit_logs` with
  `date >= today - 6`. Active users = at least one log in the window;
  `percentile = round(100 * users_with_fewer_days / active_count)`; `null` when the
  caller has no logs in the window. No denormalized counters - the table is the single
  source of truth, same philosophy as quota.

## Frontend

- `api.ts`: `FitStatus`/`FitWeekDay` types, `api.fitStatus()`, `api.logFit(...)`.
  `store.ts`: `streakCache = createCachedResource(() => api.fitStatus())`.
- New tab "Streak" -> `pages/Streak.tsx`: streak hero number, Mon-Sun week grid,
  longest / points / closet score / percentile, garment multi-select logging fed from
  `garmentsCache` (optimistic, rollback on failure), `EmptyState` for an empty closet.
- `pages/Today.tsx`: one-tap "I wore this" on the recommendation card
  (`source: "recommendation"`), flips to a logged state and shows a streak chip.
- `components/ShareCard.tsx`: offscreen 1080x1350 canvas, purely typographic (no
  photos: avoids s3 canvas-taint CORS and any privacy surface) - brand, streak number,
  week squares, closet score, date. `canvas.toBlob` -> `navigator.share({files})` when
  available, else PNG download. "Copy text" writes the emoji grid to the clipboard.

### Alternatives rejected

1. **Friends graph + in-app leaderboard** (Strava proper): most motivating long term
   but 2-3x the work (graph tables, invites, privacy, blocking) and breaks the app's
   total user isolation. The share card gets comparison shipping now; a graph can come
   later without wasted work.
2. **Closet score as the headline stat**: plateaus once the closet is built and can
   push purchases; wrong incentive for a daily habit loop. Kept as secondary.
3. **Photo check-ins as the daily action**: richest proof, but high friction plus
   privacy/moderation weight the app has not taken on. The garment log also seeds
   cost-per-wear later.

## Out of scope (follow-ups)

Friends/follow, leaderboards, usernames/public profiles, streak-freeze purchases,
photo check-ins, cost-per-wear, daily themed challenges.
