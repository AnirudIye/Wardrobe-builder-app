from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from app.models.calendar_event import CalendarEvent
from app.models.garment import Garment
from app.services import llm
from app.services.weather import WeatherSnapshot

logger = logging.getLogger(__name__)

# Categories, in the order we'd assemble an outfit.
_CORE_CATEGORIES = ["top", "bottom", "footwear"]

# Formality scale shared by garments and calendar events (least → most formal).
_FORMALITY_RANK = {
    "athletic": 0,
    "casual": 1,
    "smart-casual": 2,
    "business": 3,
    "formal": 4,
}


def dressiest_event(events: List[CalendarEvent]) -> Optional[CalendarEvent]:
    """The event with the most formal dress code, or None."""
    if not events:
        return None
    return max(events, key=lambda e: _FORMALITY_RANK.get(e.event_type, 1))


@dataclass
class OutfitResult:
    garment_ids: List[int]
    rationale: str
    source: str  # "ai" or "heuristic"
    weather: Optional[WeatherSnapshot] = None
    extras: dict = field(default_factory=dict)


def _target_warmth(temp_c: Optional[float]) -> int:
    """Map temperature to a 1 (light) - 5 (very warm) target warmth."""
    if temp_c is None:
        return 3
    if temp_c >= 24:
        return 1
    if temp_c >= 16:
        return 2
    if temp_c >= 8:
        return 3
    if temp_c >= 0:
        return 4
    return 5


def _pick_by_category(
    garments: List[Garment],
    category: str,
    target: int,
    target_formality: Optional[str] = None,
) -> Optional[Garment]:
    candidates = [g for g in garments if (g.category or "").lower() == category]
    if not candidates:
        return None

    target_rank = _FORMALITY_RANK.get(target_formality or "", None)

    def score(g: Garment) -> int:
        # Warmth mismatch; unrated garments treated as target (neutral).
        s = abs((g.warmth_rating or target) - target)
        # Formality mismatch dominates when an event sets a dress code.
        if target_rank is not None:
            g_rank = _FORMALITY_RANK.get((g.formality or "").lower(), None)
            s += 10 * (abs(g_rank - target_rank) if g_rank is not None else 2)
        return s

    return min(candidates, key=score)


def heuristic_outfit(
    garments: List[Garment],
    weather: Optional[WeatherSnapshot],
    events: Optional[List[CalendarEvent]] = None,
) -> OutfitResult:
    """Deterministic fallback: pick one garment per core category by warmth
    match, biased toward the dress code of today's dressiest event."""
    target = _target_warmth(weather.temp_c if weather else None)
    key_event = dressiest_event(events or [])
    target_formality = key_event.event_type if key_event else None

    chosen: List[int] = []
    for category in _CORE_CATEGORIES:
        pick = _pick_by_category(garments, category, target, target_formality)
        if pick is not None:
            chosen.append(pick.id)
    # Add outerwear when it's cold.
    if target >= 4:
        outer = _pick_by_category(garments, "outerwear", target, target_formality)
        if outer is not None:
            chosen.append(outer.id)

    parts = []
    if weather is not None:
        parts.append(f"It's about {round(weather.temp_c)}°C with {weather.description}.")
    if key_event is not None:
        parts.append(f'You have "{key_event.title}" ({key_event.event_type}) today, so the picks lean {key_event.event_type}.')
    if not parts:
        parts.append("No weather available, so picked a balanced everyday outfit from your wardrobe.")
    else:
        parts.append(f"Picked pieces around warmth level {target}/5 from your wardrobe.")
    return OutfitResult(
        garment_ids=chosen, rationale=" ".join(parts), source="heuristic", weather=weather
    )


def _garment_summary(g: Garment) -> dict:
    return {
        "id": g.id,
        "category": g.category,
        "subcategory": g.subcategory,
        "colors": g.colors or [],
        "formality": g.formality,
        "warmth_rating": g.warmth_rating,
        "seasons": g.seasons or [],
    }


def _events_text(events: Optional[List[CalendarEvent]]) -> str:
    if not events:
        return "none"
    return "; ".join(
        f'"{e.title}" (dress code: {e.event_type}'
        + (f", notes: {e.notes}" if e.notes else "")
        + ")"
        for e in events
    )


def _ai_outfit(
    garments: List[Garment],
    weather: Optional[WeatherSnapshot],
    trend_summary: Optional[str],
    prefs: Optional[dict],
    events: Optional[List[CalendarEvent]] = None,
) -> Optional[OutfitResult]:
    """Ask the AI to assemble an outfit from owned garment IDs. None on any failure."""
    if not llm.available():
        return None
    try:
        owned_ids = {g.id for g in garments}
        catalog = [_garment_summary(g) for g in garments]
        weather_text = (
            f"{round(weather.temp_c)}°C, feels like {round(weather.feels_like_c)}°C, "
            f"{weather.description}, wind {weather.wind_kph} kph"
            if weather
            else "unknown"
        )
        prompt = (
            "You are a personal stylist. From ONLY the wardrobe items below, assemble a "
            "single sensible outfit for today. Use each item's id.\n"
            f"Weather: {weather_text}\n"
            f"Today's events: {_events_text(events)}\n"
            f"Current trends: {trend_summary or 'n/a'}\n"
            f"User style preferences: {json.dumps(prefs) if prefs else 'none'}\n"
            f"Wardrobe items: {json.dumps(catalog)}\n\n"
            'Reply with ONLY JSON: {"garment_ids": [<ids>], "rationale": "<one or two sentences>"}. '
            "Choose at least a top and bottom when available, add outerwear if cold. "
            "Match the dress code of today's events (dress for the most formal one). "
            "Only use ids from the wardrobe list."
        )
        text = llm.complete(prompt=prompt, max_tokens=512)
        if text is None:
            return None
        brace = text.find("{")
        if brace == -1:
            return None
        data = json.loads(text[brace : text.rfind("}") + 1])
        ids = [int(i) for i in data.get("garment_ids", []) if int(i) in owned_ids]
        if not ids:
            return None
        rationale = str(data.get("rationale", "")).strip() or "A stylist-picked outfit for today."
        return OutfitResult(garment_ids=ids, rationale=rationale, source="ai", weather=weather)
    except Exception as exc:  # network/parse/SDK errors — caller falls back
        logger.warning("AI outfit recommendation failed: %s", exc)
        return None


def recommend_outfit(
    garments: List[Garment],
    weather: Optional[WeatherSnapshot],
    trend_summary: Optional[str] = None,
    prefs: Optional[dict] = None,
    events: Optional[List[CalendarEvent]] = None,
) -> OutfitResult:
    """Recommend an outfit, preferring the AI path and falling back to the heuristic."""
    ai = _ai_outfit(garments, weather, trend_summary, prefs, events)
    if ai is not None:
        return ai
    return heuristic_outfit(garments, weather, events)


# --- Buy-next (wardrobe gap analysis) ------------------------------------

# What a well-rounded wardrobe should cover, with a demo search query.
_WARDROBE_COVERAGE = [
    ("outerwear", "a versatile jacket or coat", "versatile lightweight jacket"),
    ("footwear", "a pair of everyday shoes", "minimal everyday sneakers"),
    ("top", "a few staple tops", "plain crewneck t-shirt"),
    ("bottom", "a reliable pair of trousers", "slim chino trousers"),
]


@dataclass
class PurchaseSuggestion:
    description: str
    rationale: str
    query: str


def heuristic_purchases(garments: List[Garment]) -> List[PurchaseSuggestion]:
    """Suggest gap-filling pieces based on missing wardrobe categories."""
    present = {(g.category or "").lower() for g in garments}
    suggestions: List[PurchaseSuggestion] = []
    for category, description, query in _WARDROBE_COVERAGE:
        if category not in present:
            suggestions.append(
                PurchaseSuggestion(
                    description=description,
                    rationale=f"You have no {category} yet — a staple would round out your wardrobe.",
                    query=query,
                )
            )
    if not suggestions:
        suggestions.append(
            PurchaseSuggestion(
                description="a trend-forward accessory",
                rationale="Your basics are covered — an accessory can refresh your looks.",
                query="minimal leather belt",
            )
        )
    return suggestions[:4]


def _ai_purchases(
    garments: List[Garment], trend_summary: Optional[str], prefs: Optional[dict]
) -> Optional[List[PurchaseSuggestion]]:
    if not llm.available():
        return None
    try:
        catalog = [_garment_summary(g) for g in garments]
        prompt = (
            "You are a personal shopper. Given the user's wardrobe, current trends, and "
            "preferences, suggest 3-4 NEW pieces they should buy to fill gaps and stay current.\n"
            f"Current trends: {trend_summary or 'n/a'}\n"
            f"User style preferences: {json.dumps(prefs) if prefs else 'none'}\n"
            f"Wardrobe: {json.dumps(catalog)}\n\n"
            'Reply with ONLY JSON: {"suggestions": [{"description": "...", '
            '"rationale": "...", "query": "<short shopping search query>"}]}.'
        )
        text = llm.complete(prompt=prompt, max_tokens=700)
        if text is None:
            return None
        brace = text.find("{")
        if brace == -1:
            return None
        data = json.loads(text[brace : text.rfind("}") + 1])
        out: List[PurchaseSuggestion] = []
        for s in data.get("suggestions", [])[:4]:
            desc = str(s.get("description", "")).strip()
            if not desc:
                continue
            out.append(
                PurchaseSuggestion(
                    description=desc,
                    rationale=str(s.get("rationale", "")).strip(),
                    query=str(s.get("query") or desc).strip(),
                )
            )
        return out or None
    except Exception as exc:
        logger.warning("AI purchase suggestions failed: %s", exc)
        return None


def suggest_purchases(
    garments: List[Garment], trend_summary: Optional[str] = None, prefs: Optional[dict] = None
) -> Tuple[List[PurchaseSuggestion], str]:
    """Return (suggestions, source) preferring AI, falling back to the heuristic."""
    ai = _ai_purchases(garments, trend_summary, prefs)
    if ai is not None:
        return ai, "ai"
    return heuristic_purchases(garments), "heuristic"
