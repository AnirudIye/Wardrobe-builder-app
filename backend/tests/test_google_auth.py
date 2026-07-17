from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services import google_oauth
from app.services.google_oauth import GoogleIdentity


def _sign_in(client: TestClient, credential: str = "fake-google-credential"):
    return client.post("/auth/google", json={"credential": credential})


def test_google_config_empty_when_unconfigured(client: TestClient):
    resp = client.get("/auth/google/config")
    assert resp.status_code == 200
    assert resp.json() == {"client_id": None}


def test_google_config_returns_client_id(client: TestClient, monkeypatch):
    monkeypatch.setattr(google_oauth, "client_id", lambda: "abc.apps.googleusercontent.com")
    resp = client.get("/auth/google/config")
    assert resp.json() == {"client_id": "abc.apps.googleusercontent.com"}


def test_google_sign_in_503_when_unconfigured(client: TestClient):
    assert _sign_in(client).status_code == 503


def test_google_sign_in_creates_verified_account(client: TestClient, monkeypatch):
    monkeypatch.setattr(google_oauth, "available", lambda: True)
    monkeypatch.setattr(
        google_oauth,
        "verify",
        lambda cred: GoogleIdentity(email="new@gmail.com", email_verified=True),
    )
    resp = _sign_in(client)
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@gmail.com"
    assert me.json()["email_verified"] is True

    # Second sign-in reuses the same account (no duplicate).
    again = _sign_in(client)
    assert again.status_code == 200
    me2 = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {again.json()['access_token']}"}
    )
    assert me2.json()["id"] == me.json()["id"]


def test_google_sign_in_links_existing_password_account(client: TestClient, monkeypatch):
    client.post(
        "/auth/register", json={"email": "linked@gmail.com", "password": "supersecret1"}
    )
    monkeypatch.setattr(google_oauth, "available", lambda: True)
    monkeypatch.setattr(
        google_oauth,
        "verify",
        lambda cred: GoogleIdentity(email="linked@gmail.com", email_verified=True),
    )
    resp = _sign_in(client)
    assert resp.status_code == 200
    me = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"}
    )
    assert me.json()["email"] == "linked@gmail.com"

    # The original password still works.
    pw = client.post(
        "/auth/login", data={"username": "linked@gmail.com", "password": "supersecret1"}
    )
    assert pw.status_code == 200


def test_google_sign_in_rejects_bad_credential(client: TestClient, monkeypatch):
    monkeypatch.setattr(google_oauth, "available", lambda: True)
    monkeypatch.setattr(google_oauth, "verify", lambda cred: None)
    assert _sign_in(client).status_code == 401


def test_google_sign_in_rejects_unverified_google_email(client: TestClient, monkeypatch):
    monkeypatch.setattr(google_oauth, "available", lambda: True)
    monkeypatch.setattr(
        google_oauth,
        "verify",
        lambda cred: GoogleIdentity(email="shady@gmail.com", email_verified=False),
    )
    assert _sign_in(client).status_code == 403


def test_verify_returns_none_without_config():
    # Best-effort contract: no client id configured -> None, never raises.
    assert google_oauth.verify("anything") is None
