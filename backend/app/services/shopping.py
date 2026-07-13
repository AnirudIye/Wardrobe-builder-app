from __future__ import annotations

import logging
from typing import List

import httpx

from app.config import get_settings
from app.schemas.recommendation import ProductSuggestion

logger = logging.getLogger(__name__)

_SERPAPI_URL = "https://serpapi.com/search.json"


def search_products(query: str, limit: int = 3) -> List[ProductSuggestion]:
    """Search real products for a query via SerpAPI Google Shopping.

    Best-effort: returns [] when no API key is configured or the call fails.
    """
    settings = get_settings()
    if not settings.serpapi_key:
        return []
    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": settings.serpapi_key,
        "num": limit,
    }
    try:
        resp = httpx.get(_SERPAPI_URL, params=params, timeout=15.0)
        resp.raise_for_status()
        results = resp.json().get("shopping_results", []) or []
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Shopping search failed for %r: %s", query, exc)
        return []

    products: List[ProductSuggestion] = []
    for item in results[:limit]:
        products.append(
            ProductSuggestion(
                title=str(item.get("title", "")),
                price=item.get("price"),
                link=item.get("product_link") or item.get("link"),
                thumbnail=item.get("thumbnail"),
                source=item.get("source"),
            )
        )
    return products
