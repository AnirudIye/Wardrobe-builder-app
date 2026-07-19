"""Closet score: a deterministic 0-100 measure of wardrobe coverage.

Pure function over garment-shaped objects (anything with category /
formality / seasons attributes). No AI calls - the score must be free,
instant, and identical for identical closets.
"""

from __future__ import annotations

from typing import Iterable

from app.services.recommendation import _FORMALITY_RANK

# The vision service's category vocabulary (services/vision.py); accessory /
# underwear / other add depth but are not "essential slots".
_ESSENTIAL_CATEGORIES = {"top", "bottom", "footwear", "outerwear", "dress"}
_SEASONS = {"spring", "summer", "fall", "winter"}


def closet_score(garments: Iterable) -> int:
    """Category coverage 40 + formality spread 30 + seasons 20 + depth 10."""
    items = list(garments)
    categories = set()
    formalities = set()
    seasons = set()
    for g in items:
        category = (g.category or "").lower()
        if category in _ESSENTIAL_CATEGORIES:
            categories.add(category)
        formality = (g.formality or "").lower()
        if formality in _FORMALITY_RANK:
            formalities.add(formality)
        for s in g.seasons or []:
            if s.lower() in _SEASONS:
                seasons.add(s.lower())
    # Depth: half a point per item up to 20 items, integer math throughout.
    depth = min(len(items), 20) // 2
    return 8 * len(categories) + 6 * len(formalities) + 5 * len(seasons) + depth
