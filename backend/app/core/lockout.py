from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from app.config import get_settings

# Per-account login lockout: after N failed password attempts inside a sliding
# window, the account refuses even the correct password until the oldest
# failure ages out (or a password reset proves inbox ownership). Complements
# the per-IP limiter in ratelimit.py, which a distributed guesser can sidestep.
# Same deliberate trade-offs as the limiter: in-process, dependency-free,
# per-worker counters; shares the RATE_LIMIT_ENABLED kill switch so the test
# suite and zero-config dev setups behave identically.

_failures: Dict[int, Deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _window_seconds() -> int:
    return get_settings().login_lockout_minutes * 60


def retry_after(user_id: int) -> int:
    """Seconds until this account may try again, or 0 if not locked."""
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return 0
    now = time.monotonic()
    window = _window_seconds()
    with _lock:
        failures = _failures[user_id]
        while failures and now - failures[0] > window:
            failures.popleft()
        if len(failures) < settings.login_lockout_attempts:
            return 0
        return max(1, int(window - (now - failures[0])) + 1)


def record_failure(user_id: int) -> None:
    """Note one failed password attempt for this account."""
    if not get_settings().rate_limit_enabled:
        return
    with _lock:
        _failures[user_id].append(time.monotonic())


def clear(user_id: int) -> None:
    """Forget failures (successful login, or a redeemed password reset)."""
    with _lock:
        _failures.pop(user_id, None)


def reset() -> None:
    """Clear all state (test hook)."""
    with _lock:
        _failures.clear()
