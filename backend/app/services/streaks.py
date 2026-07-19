"""Streak math for the fit-streak feature.

Pure functions over plain values (sets/dicts of dates) so they unit-test
without a database. All dates are the client's local calendar days
(client-supplies-local-date pattern); never feed UTC-derived dates in here.

Grace rule: one missed day per ISO week (Mon-Sun) is forgiven - an
automatic weekly "rest day". A second miss in the same week ends the run.
Forgiven days never add to the count.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Mapping, Optional, Set, Tuple

_ONE_DAY = timedelta(days=1)


def _week_key(day: date) -> Tuple[int, int]:
    iso = day.isocalendar()
    return (iso[0], iso[1])


def current_streak(logged: Set[date], today: date) -> int:
    """Length of the streak ending now.

    An unlogged today never breaks the streak - the day is not over - so the
    backward walk starts at yesterday in that case.
    """
    if not logged:
        return 0
    earliest = min(logged)
    day = today if today in logged else today - _ONE_DAY
    streak = 0
    misses: Dict[Tuple[int, int], int] = {}
    while day >= earliest:
        if day in logged:
            streak += 1
        else:
            week = _week_key(day)
            misses[week] = misses.get(week, 0) + 1
            if misses[week] > 1:
                break
        day -= _ONE_DAY
    return streak


def longest_streak(logged: Set[date]) -> int:
    """Best run ever, applying the same one-rest-day-per-week rule."""
    if not logged:
        return 0
    best = run = 0
    misses: Dict[Tuple[int, int], int] = {}
    day, last = min(logged), max(logged)
    while day <= last:
        if day in logged:
            run += 1
            best = max(best, run)
        else:
            week = _week_key(day)
            misses[week] = misses.get(week, 0) + 1
            if misses[week] > 1:
                # Run broken. Miss tracking resets with it: earlier misses
                # belong to the dead run and must not penalize the next one.
                run = 0
                misses = {}
        day += _ONE_DAY
    return best


def week_grid(logs: Mapping[date, str], today: date) -> List[dict]:
    """The 7 Mon-Sun entries of today's ISO week: date / logged / source."""
    monday = today - timedelta(days=today.weekday())
    grid = []
    for i in range(7):
        day = monday + timedelta(days=i)
        source: Optional[str] = logs.get(day)
        grid.append({"date": day, "logged": source is not None, "source": source})
    return grid


def week_points(days_logged: int, distinct_garments: int) -> int:
    """Weekly style points: 10 per logged day + capped variety bonus."""
    return 10 * days_logged + min(2 * distinct_garments, 30)
