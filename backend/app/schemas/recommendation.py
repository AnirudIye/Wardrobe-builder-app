from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from app.schemas.garment import GarmentOut
from app.services.weather import WeatherSnapshot


class OutfitRecommendationOut(BaseModel):
    items: List[GarmentOut]
    rationale: str
    source: str  # "ai" or "heuristic"
    weather: Optional[WeatherSnapshot] = None


class ProductSuggestion(BaseModel):
    title: str
    price: Optional[str] = None
    link: Optional[str] = None
    thumbnail: Optional[str] = None
    source: Optional[str] = None


class BuyNextItem(BaseModel):
    description: str
    rationale: str
    products: List[ProductSuggestion] = []
    # Always-present shoppable link (Google Shopping search for the suggestion),
    # so every suggestion links to real products even without SerpAPI results.
    search_url: Optional[str] = None


class BuyNextOut(BaseModel):
    suggestions: List[BuyNextItem]
    source: str  # "ai" or "heuristic"
