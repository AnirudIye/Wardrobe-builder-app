from __future__ import annotations

import logging
import time
from typing import Optional, Tuple

from app.config import get_settings

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 6 * 3600  # 6 hours
_cache: Optional[Tuple[float, str]] = None

_FALLBACK = (
    "Timeless staples remain central this season: relaxed tailoring, earth and "
    "neutral tones, quality knitwear, and clean minimal sneakers. Layering with a "
    "versatile overshirt or trench is a reliable move."
)


def get_trends() -> str:
    """Return a short current-fashion-trends summary (cached ~6h).

    Uses Claude when a key is configured; otherwise returns a sensible static
    summary so downstream recommendations still work.
    """
    global _cache
    now = time.monotonic()
    if _cache is not None and (now - _cache[0]) < _CACHE_TTL_SECONDS:
        return _cache[1]

    summary = _ai_trends() or _FALLBACK
    _cache = (now, summary)
    return summary


def _ai_trends() -> Optional[str]:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "In 2-3 sentences, summarize current everyday fashion trends "
                        "(colours, silhouettes, key pieces) a general audience could apply. "
                        "Be concrete and practical. Plain text only."
                    ),
                }
            ],
        )
        text = "".join(
            b.text for b in response.content if getattr(b, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:  # best-effort
        logger.warning("Trend fetch failed: %s", exc)
        return None


def clear_cache() -> None:
    global _cache
    _cache = None
