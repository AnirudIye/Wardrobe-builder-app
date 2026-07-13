from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.schemas.recommendation import ProductSuggestion
from app.services import shopping, trends
from app.services.recommendation import heuristic_purchases
from tests.helpers import auth_headers, sample_image_bytes


class _FakeGarment:
    def __init__(self, category):
        self.id = 1
        self.category = category
        self.warmth_rating = 3
        self.colors = []
        self.seasons = []
        self.subcategory = None
        self.formality = None


def test_trends_fallback_without_key():
    trends.clear_cache()
    summary = trends.get_trends()
    assert isinstance(summary, str) and len(summary) > 10


def test_shopping_without_key_returns_empty():
    assert shopping.search_products("anything") == []


def test_heuristic_purchases_flags_missing_categories():
    # Only a top present → should suggest outerwear, footwear, bottom.
    suggestions = heuristic_purchases([_FakeGarment("top")])
    descriptions = " ".join(s.description for s in suggestions).lower()
    assert "jacket" in descriptions or "coat" in descriptions
    assert any("shoes" in s.description.lower() for s in suggestions)


def test_trends_endpoint(client: TestClient):
    headers = auth_headers(client)
    resp = client.get("/trends", headers=headers)
    assert resp.status_code == 200
    assert "summary" in resp.json()


def test_buy_next_returns_suggestions_with_products(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    # Mock the shopping backend to return a real-looking product.
    def fake_search(query, limit=3):
        return [ProductSuggestion(title=f"Result for {query}", price="$40", link="https://shop.example/x")]

    monkeypatch.setattr(shopping, "search_products", fake_search)

    headers = auth_headers(client)
    # Empty wardrobe → heuristic suggests staples for every category.
    resp = client.get("/recommendations/buy-next", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"] in ("ai", "heuristic")
    assert len(body["suggestions"]) >= 1
    first = body["suggestions"][0]
    assert first["products"][0]["link"] == "https://shop.example/x"
