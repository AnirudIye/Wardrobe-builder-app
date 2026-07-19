from __future__ import annotations

from datetime import date, timedelta

from app.services.challenges import CHALLENGES, challenge_for


def test_same_day_same_challenge_for_everyone():
    day = date(2026, 7, 18)
    assert challenge_for(day) == challenge_for(day)


def test_consecutive_days_differ():
    day = date(2026, 7, 18)
    assert challenge_for(day) != challenge_for(day + timedelta(days=1))


def test_cycles_through_the_whole_list():
    start = date(2026, 1, 1)
    seen = {challenge_for(start + timedelta(days=i))["name"] for i in range(len(CHALLENGES))}
    assert len(seen) == len(CHALLENGES)


def test_every_challenge_is_well_formed():
    assert len(CHALLENGES) >= 21  # at least three weeks before any repeat
    for c in CHALLENGES:
        assert c["name"] and c["brief"]
        assert len(c["name"]) <= 40
