from __future__ import annotations

from fastapi.testclient import TestClient


def _register(client: TestClient, email: str = "a@example.com", password: str = "supersecret1"):
    return client.post("/auth/register", json={"email": email, "password": password})


def _login(client: TestClient, email: str = "a@example.com", password: str = "supersecret1"):
    # OAuth2 password form uses `username`/`password` form fields.
    return client.post("/auth/login", data={"username": email, "password": password})


def test_health(client: TestClient):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_returns_free_plan_user(client: TestClient):
    resp = _register(client)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == "a@example.com"
    assert body["plan"] == "free"
    assert "id" in body
    assert "hashed_password" not in body  # never leak the hash


def test_register_duplicate_email_conflicts(client: TestClient):
    _register(client)
    resp = _register(client)
    assert resp.status_code == 409


def test_register_rejects_short_password(client: TestClient):
    resp = _register(client, password="short")
    assert resp.status_code == 422


def test_login_success_returns_token(client: TestClient):
    _register(client)
    resp = _login(client)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password_unauthorized(client: TestClient):
    _register(client)
    resp = _login(client, password="wrongpassword1")
    assert resp.status_code == 401


def test_me_requires_auth(client: TestClient):
    assert client.get("/auth/me").status_code == 401


def test_me_returns_current_user(client: TestClient):
    _register(client)
    token = _login(client).json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "a@example.com"


def test_me_rejects_garbage_token(client: TestClient):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_new_user_exposes_verification_and_avatar_fields(client: TestClient):
    _register(client, email="fields@example.com")
    token = _login(client, email="fields@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/auth/me", headers=headers).json()
    assert "email_verified" in me

    profile = client.get("/profile", headers=headers).json()
    assert "avatar_url" in profile
    assert profile["avatar_url"] is None
