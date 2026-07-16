from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict

from fastapi import HTTPException, Request, status

from app.config import get_settings

# In-process sliding-window rate limiter for abuse-prone endpoints (auth).
# Deliberately dependency-free and per-process: with a single uvicorn worker
# this is exact; with N workers the effective limit is N x `times`, which is
# still a meaningful brake. A shared Redis backend is the multi-worker upgrade.

_hits: Dict[str, Deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def rate_limit(scope: str, times: int, seconds: int) -> Callable:
    """FastAPI dependency: allow `times` requests per `seconds` per client IP.

    Raises 429 with a Retry-After header when exceeded. No-op when
    RATE_LIMIT_ENABLED=false (the test suite disables it).
    """

    def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{ip}"
        now = time.monotonic()
        with _lock:
            window = _hits[key]
            while window and now - window[0] > seconds:
                window.popleft()
            if len(window) >= times:
                retry_after = max(1, int(seconds - (now - window[0])) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please try again shortly.",
                    headers={"Retry-After": str(retry_after)},
                )
            window.append(now)

    return dependency


def reset() -> None:
    """Clear all counters (test hook)."""
    with _lock:
        _hits.clear()
