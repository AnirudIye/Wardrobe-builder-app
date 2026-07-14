from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.schemas.recommendation import ProductSuggestion
from tests.helpers import auth_headers, sample_image_bytes


def test_search_returns_products(client: TestClient):
    headers = auth_headers(client)
    fake = [
        ProductSuggestion(title="Tan trench coat", price="$89", link="https://shop.example/tc",
                          thumbnail="https://img.example/tc.jpg", source="Example Shop")
    ]
    with patch("app.routers.wardrobe.shopping.search_products", return_value=fake):
        resp = client.get("/wardrobe/search?q=tan trench coat", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["title"] == "Tan trench coat"
    assert body[0]["link"] == "https://shop.example/tc"


def test_search_requires_auth(client: TestClient):
    assert client.get("/wardrobe/search?q=coat").status_code == 401


def _mock_httpx_stream(payload: bytes):
    """Mimic httpx.stream context manager yielding a response with payload bytes."""

    class _FakeResp:
        def raise_for_status(self):
            return None

        def iter_bytes(self):
            yield payload

    @contextmanager
    def _fake_stream(method, url, **kwargs):
        yield _FakeResp()

    return _fake_stream


def test_add_from_web_creates_garment(client: TestClient):
    headers = auth_headers(client)
    png = sample_image_bytes(color="blue")
    with patch("app.services.images.httpx.stream", new=_mock_httpx_stream(png)):
        resp = client.post(
            "/wardrobe/items/from-web",
            headers=headers,
            json={"image_url": "https://img.example/shirt.png", "title": "Blue oxford shirt"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    # No Anthropic key in tests -> vision returns empty tags -> title becomes subcategory.
    assert body["subcategory"] == "Blue oxford shirt"
    assert body["thumbnail_url"]

    items = client.get("/wardrobe/items", headers=headers).json()
    assert len(items) == 1


def test_add_from_web_rejects_non_image(client: TestClient):
    headers = auth_headers(client)
    with patch("app.services.images.httpx.stream", new=_mock_httpx_stream(b"<html>404</html>")):
        resp = client.post(
            "/wardrobe/items/from-web",
            headers=headers,
            json={"image_url": "https://img.example/missing.png"},
        )
    assert resp.status_code == 400
    assert "not a valid image" in resp.json()["detail"]


def test_add_from_web_rejects_bad_scheme(client: TestClient):
    headers = auth_headers(client)
    resp = client.post(
        "/wardrobe/items/from-web",
        headers=headers,
        json={"image_url": "ftp://img.example/shirt.png"},
    )
    assert resp.status_code == 400


def test_retag_fills_only_missing_fields(client: TestClient, monkeypatch):
    from app.routers import wardrobe as wardrobe_router
    from app.schemas.garment import GarmentTags

    headers = auth_headers(client)
    item = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("top.png", sample_image_bytes("red"), "image/png")},
    ).json()
    # User already set category by hand; warmth is missing.
    client.patch(f"/wardrobe/items/{item['id']}", headers=headers, json={"category": "bottom"})

    fake = GarmentTags(category="top", warmth_rating=4, colors=["red"], formality="casual")
    monkeypatch.setattr(wardrobe_router.vision, "auto_tag", lambda _b: fake)

    resp = client.post(f"/wardrobe/items/{item['id']}/retag", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["category"] == "bottom"  # user's value preserved
    assert body["warmth_rating"] == 4  # AI filled the gap
    assert body["colors"] == ["red"]
    assert body["formality"] == "casual"


def test_retag_checks_ownership(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    item = client.post(
        "/wardrobe/items",
        headers=a,
        files={"file": ("x.png", sample_image_bytes(), "image/png")},
    ).json()
    assert client.post(f"/wardrobe/items/{item['id']}/retag", headers=b).status_code == 404


def test_buy_next_includes_search_url(client: TestClient):
    headers = auth_headers(client)
    resp = client.get("/recommendations/buy-next", headers=headers)
    assert resp.status_code == 200
    for s in resp.json()["suggestions"]:
        assert s["search_url"].startswith("https://www.google.com/search?tbm=shop&q=")
