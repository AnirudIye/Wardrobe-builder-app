from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, sample_image_bytes


def _upload(client: TestClient, headers: dict, color: str = "red"):
    return client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("shirt.png", sample_image_bytes(color), "image/png")},
    )


def test_upload_requires_auth(client: TestClient):
    resp = client.post(
        "/wardrobe/items",
        files={"file": ("shirt.png", sample_image_bytes(), "image/png")},
    )
    assert resp.status_code == 401


def test_upload_returns_urls_and_empty_tags(client: TestClient):
    headers = auth_headers(client)
    resp = _upload(client, headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["image_url"].startswith("http://testserver/media/")
    assert body["thumbnail_url"].endswith("_thumb.jpg")
    assert body["colors"] == []
    assert body["category"] is None


def test_upload_rejects_non_image(client: TestClient):
    headers = auth_headers(client)
    resp = client.post(
        "/wardrobe/items",
        headers=headers,
        files={"file": ("notes.txt", b"this is not an image", "text/plain")},
    )
    assert resp.status_code == 400


def test_patch_price_persists(client: TestClient):
    headers = auth_headers(client)
    garment_id = _upload(client, headers).json()["id"]
    resp = client.patch(
        f"/wardrobe/items/{garment_id}", headers=headers, json={"price": 129.99}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["price"] == 129.99
    listed = client.get("/wardrobe/items", headers=headers).json()
    assert listed[0]["price"] == 129.99


def test_patch_rejects_negative_price(client: TestClient):
    headers = auth_headers(client)
    garment_id = _upload(client, headers).json()["id"]
    resp = client.patch(
        f"/wardrobe/items/{garment_id}", headers=headers, json={"price": -5}
    )
    assert resp.status_code == 422


def test_list_returns_only_own_items(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    _upload(client, a)
    _upload(client, a)
    _upload(client, b)

    a_items = client.get("/wardrobe/items", headers=a).json()
    b_items = client.get("/wardrobe/items", headers=b).json()
    assert len(a_items) == 2
    assert len(b_items) == 1


def test_cannot_access_another_users_item(client: TestClient):
    a = auth_headers(client, email="a@example.com")
    b = auth_headers(client, email="b@example.com")
    item_id = _upload(client, a).json()["id"]

    assert client.get(f"/wardrobe/items/{item_id}", headers=b).status_code == 404
    assert client.patch(f"/wardrobe/items/{item_id}", headers=b, json={"category": "x"}).status_code == 404
    assert client.delete(f"/wardrobe/items/{item_id}", headers=b).status_code == 404


def test_patch_updates_tags(client: TestClient):
    headers = auth_headers(client)
    item_id = _upload(client, headers).json()["id"]
    resp = client.patch(
        f"/wardrobe/items/{item_id}",
        headers=headers,
        json={"category": "top", "colors": ["red", "white"], "warmth_rating": 2, "seasons": ["summer"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["category"] == "top"
    assert body["colors"] == ["red", "white"]
    assert body["warmth_rating"] == 2
    assert body["seasons"] == ["summer"]


def test_patch_rejects_invalid_warmth(client: TestClient):
    headers = auth_headers(client)
    item_id = _upload(client, headers).json()["id"]
    resp = client.patch(
        f"/wardrobe/items/{item_id}", headers=headers, json={"warmth_rating": 99}
    )
    assert resp.status_code == 422


def test_delete_removes_item(client: TestClient):
    headers = auth_headers(client)
    item_id = _upload(client, headers).json()["id"]
    assert client.delete(f"/wardrobe/items/{item_id}", headers=headers).status_code == 204
    assert client.get(f"/wardrobe/items/{item_id}", headers=headers).status_code == 404
