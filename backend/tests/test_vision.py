from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.schemas.garment import GarmentTags
from app.services import vision
from tests.helpers import auth_headers, sample_image_bytes


def test_extract_json_plain():
    assert vision._extract_json('{"category": "top"}') == {"category": "top"}


def test_extract_json_fenced():
    text = 'Here you go:\n```json\n{"category": "bottom", "colors": ["blue"]}\n```'
    assert vision._extract_json(text) == {"category": "bottom", "colors": ["blue"]}


def test_extract_json_garbage_returns_none():
    assert vision._extract_json("no json here") is None


def test_auto_tag_without_api_key_returns_empty():
    # In tests all AI keys (Anthropic + Google) are blanked, so this must not
    # call the network.
    tags = vision.auto_tag(sample_image_bytes())
    assert tags == GarmentTags()


def test_upload_persists_ai_tags(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    fake = GarmentTags(
        category="outerwear",
        subcategory="trench coat",
        colors=["tan"],
        pattern="solid",
        material="cotton",
        formality="smart-casual",
        warmth_rating=3,
        seasons=["fall", "spring"],
    )
    monkeypatch.setattr(vision, "auto_tag", lambda _bytes: fake)

    headers = auth_headers(client)
    resp = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("coat.png", sample_image_bytes("tan"), "image/png")},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["category"] == "outerwear"
    assert body["colors"] == ["tan"]
    assert body["warmth_rating"] == 3
    assert body["seasons"] == ["fall", "spring"]


def test_upload_survives_tagging_failure(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    # auto_tag is best-effort; even if the underlying service raised, the router
    # relies on auto_tag swallowing it. Here we simulate it returning empty tags.
    monkeypatch.setattr(vision, "auto_tag", lambda _bytes: GarmentTags())
    headers = auth_headers(client)
    resp = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("x.png", sample_image_bytes(), "image/png")},
    )
    assert resp.status_code == 201
    assert resp.json()["category"] is None
