from __future__ import annotations

import base64
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.services import tryon
from tests.helpers import auth_headers, sample_image_bytes


def _post_tryon(client, headers, **form):
    files = {"photo": ("me.png", sample_image_bytes("blue"), "image/png")}
    return client.post("/tryon", headers=headers, files=files, data=form)


def test_tryon_requires_auth(client: TestClient):
    files = {"photo": ("me.png", sample_image_bytes(), "image/png")}
    resp = client.post("/tryon", files=files, data={"image_url": "https://x.example/a.jpg"})
    assert resp.status_code == 401


def test_tryon_requires_exactly_one_target(client: TestClient):
    headers = auth_headers(client)
    assert _post_tryon(client, headers).status_code == 400  # neither
    assert (
        _post_tryon(
            client, headers, garment_id="1", image_url="https://x.example/a.jpg"
        ).status_code
        == 400
    )  # both


def test_tryon_rejects_empty_or_invalid_photo(client: TestClient):
    headers = auth_headers(client)
    files = {"photo": ("bad.png", b"not an image", "image/png")}
    with patch("app.routers.tryon.download_image_bytes", return_value=b"garment-bytes"):
        resp = client.post(
            "/tryon", headers=headers, files=files, data={"image_url": "https://x.example/a.jpg"}
        )
    assert resp.status_code == 400
    assert "not a valid image" in resp.json()["detail"]


def test_tryon_with_image_url_succeeds(client: TestClient):
    headers = auth_headers(client)
    fake_png = b"\x89PNGfakegeneratedimage"
    with patch("app.routers.tryon.download_image_bytes", return_value=b"garment-bytes"), patch(
        "app.routers.tryon.tryon.generate_tryon", return_value=fake_png
    ):
        resp = _post_tryon(client, headers, image_url="https://x.example/shirt.jpg")
    assert resp.status_code == 200, resp.text
    assert base64.b64decode(resp.json()["image_base64"]) == fake_png


def test_tryon_with_garment_id_succeeds_and_checks_ownership(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    item = client.post(
        "/wardrobe/items",
        headers=a,
        files={"file": ("top.png", sample_image_bytes("red"), "image/png")},
    ).json()

    fake_png = b"\x89PNGfakegeneratedimage"
    with patch("app.routers.tryon.download_image_bytes", return_value=b"garment-bytes"), patch(
        "app.routers.tryon.tryon.generate_tryon", return_value=fake_png
    ):
        # Owner succeeds.
        resp = _post_tryon(client, a, garment_id=str(item["id"]))
        assert resp.status_code == 200, resp.text
        # Someone else's garment_id is a 404, not a leak.
        resp2 = _post_tryon(client, b, garment_id=str(item["id"]))
        assert resp2.status_code == 404


def test_tryon_generation_failure_is_503_and_does_not_consume_quota(client: TestClient):
    headers = auth_headers(client)
    with patch("app.routers.tryon.download_image_bytes", return_value=b"garment-bytes"), patch(
        "app.routers.tryon.tryon.generate_tryon", return_value=None
    ):
        resp = _post_tryon(client, headers, image_url="https://x.example/shirt.jpg")
    assert resp.status_code == 503

    status_resp = client.get("/billing/status", headers=headers).json()
    assert status_resp["tryon_remaining_this_week"] == 5  # unchanged - nothing charged


def test_tryon_has_its_own_weekly_quota(client: TestClient):
    headers = auth_headers(client)
    fake_png = b"\x89PNGfakegeneratedimage"
    with patch("app.routers.tryon.download_image_bytes", return_value=b"garment-bytes"), patch(
        "app.routers.tryon.tryon.generate_tryon", return_value=fake_png
    ):
        for i in range(5):
            assert (
                _post_tryon(client, headers, image_url=f"https://x.example/{i}.jpg").status_code
                == 200
            ), i
        assert (
            _post_tryon(client, headers, image_url="https://x.example/one-more.jpg").status_code
            == 402
        )

    # Other quotas (buy-next) are untouched.
    resp = client.get("/recommendations/buy-next", headers=headers)
    assert resp.status_code == 200
