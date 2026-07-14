from __future__ import annotations

import json
import logging
from typing import List, Optional

from app.config import get_settings
from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.services.recommendation import _events_text, _garment_summary
from app.services.weather import WeatherSnapshot

logger = logging.getLogger(__name__)

FALLBACK_REPLY = (
    "I can't reach my styling brain right now — try again in a moment. "
    "In the meantime, check the Today tab for a quick outfit pick."
)


def _system_prompt(
    garments: List[Garment],
    weather: Optional[WeatherSnapshot],
    events: List[CalendarEvent],
    prefs: Optional[dict],
) -> str:
    weather_text = (
        f"{round(weather.temp_c)}°C, feels like {round(weather.feels_like_c)}°C, "
        f"{weather.description}, wind {weather.wind_kph} kph"
        if weather
        else "unknown"
    )
    catalog = [_garment_summary(g) for g in garments]
    return (
        "You are DresserAI, a friendly personal stylist embedded in the BetterDresser app. "
        "Answer the user's styling questions and give specific, actionable recommendations "
        "drawn from their actual wardrobe below whenever relevant — reference items by "
        "category/color/subcategory rather than by numeric id. Keep replies conversational "
        "and concise (a few sentences, occasionally a short list).\n"
        f"Today's weather: {weather_text}\n"
        f"Today's events: {_events_text(events)}\n"
        f"User style preferences: {json.dumps(prefs) if prefs else 'none'}\n"
        f"User's wardrobe: {json.dumps(catalog)}"
    )


def chat_reply(
    messages: List[dict],
    garments: List[Garment],
    weather: Optional[WeatherSnapshot],
    events: List[CalendarEvent],
    prefs: Optional[dict],
) -> Optional[str]:
    """Ask Claude for the next assistant reply in a chat transcript.

    Best-effort: returns None (never raises) when no API key is configured or
    the call fails, so the router can fall back to a friendly message.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=600,
            system=_system_prompt(garments, weather, events, prefs),
            messages=messages,
        )
        text = "".join(
            b.text for b in response.content if getattr(b, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:  # network/SDK errors — caller falls back
        logger.warning("DresserAI chat failed: %s", exc)
        return None
