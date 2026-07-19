# Habit Pack: Cost-Per-Wear + Daily Challenges - Design

_Date: 2026-07-18. Status: approved (follow-up scope chosen by the user), implementing this session._

## Goal

The first two follow-ups to the fit-streak feature, chosen because they deepen the
daily habit loop without adding any social surface: **cost-per-wear** (the wear log
now makes it nearly free) and **daily themed challenges** (a shared daily prompt in
the Wordle spirit). Both stay free and unmetered; neither makes an AI call.

## Cost-per-wear

- `garments.price` (Float, nullable, user-entered, >= 0): what the user paid.
  No currency handling anywhere in the app, so the value is a plain number
  rendered with a `$` prefix by the UI. Set via the existing
  `PATCH /wardrobe/items/{id}` (new optional field on `GarmentUpdate`,
  exposed on `GarmentOut`).
- Wears per garment = how many `outfit_logs` rows for that user contain the
  garment id. JSON containment isn't queryable in SQLite, so the endpoint loads
  the user's logs and counts in Python - the same full-scan scale the streak
  math already accepts (about 365 rows per user per year).
- `GET /fits/wear-stats` returns per-garment `{garment_id, wears, price,
  cost_per_wear}` (`cost_per_wear` null unless price is set and wears > 0,
  else `round(price / wears, 2)`) plus aggregates: `closet_value` (sum of set
  prices), `never_worn` (owned garments with zero wears).
- UI: a small price input on each Wardrobe card (blur-to-save through the
  existing optimistic `patchItem`), a "worn N times · $X/wear" line on the
  card, and a "Best value" panel on the Streak page (top three lowest
  cost-per-wear plus the never-worn count as a gentle nudge).

## Daily challenges

- A curated list of ~28 style prompts in `services/challenges.py`
  (`{name, brief}`). The day's challenge is `CHALLENGES[date.toordinal() %
  len(CHALLENGES)]`: deterministic, timezone-correct via the client-supplied
  date, and **identical for every user on the same day** - the shared-reference
  property that makes it comparable, exactly like Wordle's single daily puzzle.
- AI-generated flavor was considered and rejected: per-user generation breaks
  the shared reference, and storing one generated challenge per day would add
  server state for no habit value. The curated list cycles monthly.
- Claiming is honor-system, like all logging: `POST /fits/log` gains
  `challenge_done: bool = false`; a new `challenge_done` column on
  `outfit_logs` stores it per day.
- Points: `week_points` gains `+5` per challenge-claimed day this ISO week
  (new ceiling: 70 + 30 + 35 = 135).
- `GET /fits/status` exposes `challenge_name`, `challenge_brief`, and today's
  `challenge_done`.
- UI: a challenge line on the Streak page, an "I did today's challenge"
  checkbox in the logging picker (prefilled when editing), and the claimed
  state shown once logged. The Today one-tap does not claim it (the claim is
  a deliberate act; Edit on the Streak tab adds it).

## Data / migration

One Alembic revision on `e7a92b3f4c1d`: add `garments.price` (nullable Float)
and `outfit_logs.challenge_done` (Boolean, NOT NULL, server_default false).

## Out of scope

Photo check-ins, the social pack (usernames/friends/leaderboards), and streak
freezes for Plus - all explicitly deferred by the user when choosing this scope.
