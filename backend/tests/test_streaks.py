from __future__ import annotations

from datetime import date, timedelta

from app.services.streaks import current_streak, longest_streak, week_grid, week_points

# A known Monday: all week-boundary cases below are pinned to this ISO week
# (Mon Jul 13 - Sun Jul 19, 2026) and the one before it.
MON = date(2026, 7, 13)


def d(offset: int) -> date:
    return MON + timedelta(days=offset)


def test_monday_anchor_is_actually_a_monday():
    assert MON.weekday() == 0


# --- current_streak ---


def test_no_logs_no_streak():
    assert current_streak(set(), d(5)) == 0


def test_single_day_logged_today():
    assert current_streak({d(5)}, d(5)) == 1


def test_unlogged_today_does_not_break_the_streak():
    # The day is not over: yesterday's log keeps the streak alive at 1.
    assert current_streak({d(4)}, d(5)) == 1


def test_plain_consecutive_run():
    assert current_streak({d(2), d(3), d(4), d(5)}, d(5)) == 4


def test_one_missed_day_in_a_week_is_forgiven():
    # Thu missed, everything else logged: rest day, streak keeps counting.
    assert current_streak({d(1), d(2), d(3), d(5)}, d(5)) == 4


def test_second_miss_in_the_same_iso_week_breaks():
    # Fri and Wed both missed inside Mon-Sun week: walk stops at the second.
    assert current_streak({d(0), d(1), d(3), d(5)}, d(5)) == 2


def test_misses_in_different_iso_weeks_are_each_forgiven():
    # Missed Mon (this week) and the prior week's Sunday... use Thu anchor:
    # logged Sat/Sun of last week and Tue of this week; Mon missed (this
    # week's rest day), and last week's Fri missed (last week's rest day).
    logged = {d(-4), d(-3), d(-1), d(1)}  # Thu, Fri missing... see below
    # d(-4)=Thu, d(-3)=Fri of prior week? No: d(-4) is Thu Jul 9, d(-3) Fri
    # Jul 10, d(-1) Sun Jul 12, d(1) Tue Jul 14. Missed: Mon Jul 13 (this
    # week) and Sat Jul 11 (prior week) - one miss per week, both forgiven.
    assert current_streak(logged, d(1)) == 4


def test_missed_yesterday_survives_via_rest_day():
    # Today unlogged, yesterday unlogged (forgiven), day before logged.
    assert current_streak({d(3)}, d(5)) == 1


def test_missed_two_days_back_is_dead():
    assert current_streak({d(2)}, d(5)) == 0


# --- longest_streak ---


def test_longest_of_empty_is_zero():
    assert longest_streak(set()) == 0


def test_longest_picks_the_best_run():
    # Run 1: Mon-Tue (Wed+Thu missed = two misses in week -> break).
    # Run 2: Fri-Sun.
    assert longest_streak({d(0), d(1), d(4), d(5), d(6)}) == 3


def test_longest_counts_forgiven_miss_runs():
    # Mon, Tue, Thu, Fri: Wed forgiven, one run of 4 logged days.
    assert longest_streak({d(0), d(1), d(3), d(4)}) == 4


def test_break_resets_week_miss_tracking():
    # Mon logged, Tue+Wed missed (break), Thu logged, Fri missed (forgiven
    # for the NEW run even though the week already saw misses), Sat logged.
    assert longest_streak({d(0), d(3), d(5)}) == 2


# --- week_grid ---


def test_week_grid_shape_and_sources():
    logs = {d(0): "manual", d(1): "recommendation"}
    grid = week_grid(logs, d(3))
    assert [g["date"] for g in grid] == [d(i) for i in range(7)]
    assert grid[0] == {"date": d(0), "logged": True, "source": "manual"}
    assert grid[1]["source"] == "recommendation"
    assert all(not g["logged"] and g["source"] is None for g in grid[2:])


def test_week_grid_starts_monday_even_late_in_week():
    grid = week_grid({}, d(6))  # Sunday
    assert grid[0]["date"] == d(0)
    assert grid[6]["date"] == d(6)


# --- week_points ---


def test_points_zero_when_nothing_logged():
    assert week_points(0, 0) == 0


def test_points_base_plus_variety():
    assert week_points(3, 3) == 36  # 30 base + 6 variety


def test_points_variety_bonus_caps_at_30():
    assert week_points(7, 40) == 100  # 70 base + capped 30


def test_points_challenge_bonus():
    assert week_points(3, 3, challenges_done=2) == 46  # 36 + 10


def test_points_perfect_week_ceiling():
    assert week_points(7, 40, challenges_done=7) == 135
