from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import (
    create_access_token,
    create_email_token,
    create_reset_token,
    decode_email_token,
    decode_reset_token,
    password_fingerprint,
)
from app.models.user import User


def _get_user(db_session, email: str = "a@example.com") -> User:
    return db_session.execute(select(User).where(User.email == email)).scalar_one()


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


def test_register_duplicate_email_conflicts_case_insensitively(client: TestClient):
    # User-reported hole: changing the email's capitalization minted a second
    # account on the same inbox (mailboxes are case-insensitive in practice).
    _register(client, email="case@example.com")
    resp = _register(client, email="CaSe@example.com")
    assert resp.status_code == 409


def test_register_stores_email_lowercased_and_login_ignores_case(client: TestClient):
    resp = _register(client, email="MiXeD@Example.com")
    assert resp.status_code == 201
    assert resp.json()["email"] == "mixed@example.com"
    assert _login(client, email="mixed@example.com").status_code == 200
    assert _login(client, email="MIXED@EXAMPLE.COM").status_code == 200


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
    assert resp.json()["detail"] == "Incorrect email or password"


def test_login_unknown_email_gets_the_same_generic_message(client: TestClient):
    # Anti-enumeration: unknown email and wrong password are indistinguishable.
    _register(client)
    unknown = _login(client, email="ghost@example.com")
    wrong = _login(client, password="wrongpassword1")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


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


def test_email_token_roundtrips():
    assert decode_email_token(create_email_token(42)) == 42


def test_email_token_rejects_a_plain_access_token():
    # An access token has no verify purpose, so it must not verify emails.
    assert decode_email_token(create_access_token(subject=42)) is None


def test_email_token_rejects_garbage():
    assert decode_email_token("not-a-token") is None


def test_register_auto_verifies_without_email_service(client: TestClient):
    r = _register(client, email="auto@example.com")
    assert r.json()["email_verified"] is True
    assert _login(client, email="auto@example.com").status_code == 200


def test_email_gate_full_flow(client: TestClient, monkeypatch):
    from app.services import email

    sent = []
    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(
        email, "send_verification_email", lambda to, link: sent.append((to, link)) or True
    )

    r = _register(client, email="gate@example.com")
    assert r.status_code == 201
    assert r.json()["email_verified"] is False

    # Cannot log in until verified.
    assert _login(client, email="gate@example.com").status_code == 403

    # A verification email was queued (background task ran) with a link token.
    assert sent and "verify_token=" in sent[0][1]

    token = create_email_token(r.json()["id"])
    verified = client.post("/auth/verify", json={"token": token})
    assert verified.status_code == 200
    assert verified.json()["access_token"]

    # Now login works.
    assert _login(client, email="gate@example.com").status_code == 200


def test_verify_rejects_bad_token(client: TestClient):
    assert client.post("/auth/verify", json={"token": "garbage"}).status_code == 400


def test_resend_always_returns_200(client: TestClient, monkeypatch):
    from app.services import email

    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(email, "send_verification_email", lambda to, link: True)
    r = client.post("/auth/resend-verification", json={"email": "nobody@example.com"})
    assert r.status_code == 200


# --- Password reset ---


def test_reset_token_roundtrips():
    token = create_reset_token(42, "someHash")
    assert decode_reset_token(token) == (42, password_fingerprint("someHash"))


def test_reset_token_rejects_other_token_kinds():
    # Wrong purposes must never unlock a password reset...
    assert decode_reset_token(create_access_token(subject=42)) is None
    assert decode_reset_token(create_email_token(42)) is None
    # ...and a reset token must never verify an email.
    assert decode_email_token(create_reset_token(42, "h")) is None


def test_reset_token_rejects_garbage():
    assert decode_reset_token("not-a-token") is None


def test_forgot_password_is_generic_and_sends_only_for_real_accounts(
    client: TestClient, monkeypatch
):
    from app.services import email

    sent = []
    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(
        email, "send_password_reset_email", lambda to, link: sent.append((to, link)) or True
    )

    _register(client)
    known = client.post("/auth/forgot-password", json={"email": "a@example.com"})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})

    # Anti-enumeration: identical response either way.
    assert known.status_code == 200 and unknown.status_code == 200
    assert known.json() == unknown.json()

    # But only the real account got an email, with a reset link in it.
    assert len(sent) == 1
    to, link = sent[0]
    assert to == "a@example.com"
    assert "reset_token=" in link


def test_reset_password_full_flow(client: TestClient, db_session):
    _register(client)
    user = _get_user(db_session)
    token = create_reset_token(user.id, user.hashed_password)

    r = client.post("/auth/reset-password", json={"token": token, "password": "brandnewpass1"})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]  # signed straight in

    # Old password is dead, the new one works.
    assert _login(client).status_code == 401
    assert _login(client, password="brandnewpass1").status_code == 200


def test_reset_token_is_single_use(client: TestClient, db_session):
    _register(client)
    user = _get_user(db_session)
    token = create_reset_token(user.id, user.hashed_password)

    first = client.post("/auth/reset-password", json={"token": token, "password": "brandnewpass1"})
    assert first.status_code == 200
    # Same token again: the fingerprint no longer matches the new hash.
    again = client.post("/auth/reset-password", json={"token": token, "password": "anotherpass12"})
    assert again.status_code == 400


def test_reset_password_rejects_garbage_token(client: TestClient):
    r = client.post("/auth/reset-password", json={"token": "junk", "password": "longenough12"})
    assert r.status_code == 400


def test_reset_password_rejects_wrong_purpose_token(client: TestClient, db_session):
    _register(client)
    user = _get_user(db_session)
    r = client.post(
        "/auth/reset-password",
        json={"token": create_email_token(user.id), "password": "longenough12"},
    )
    assert r.status_code == 400


def test_reset_password_rejects_short_password(client: TestClient, db_session):
    _register(client)
    user = _get_user(db_session)
    token = create_reset_token(user.id, user.hashed_password)
    r = client.post("/auth/reset-password", json={"token": token, "password": "short"})
    assert r.status_code == 422


def test_reset_password_verifies_unverified_user(client: TestClient, db_session, monkeypatch):
    from app.services import email

    monkeypatch.setattr(email, "available", lambda: True)
    monkeypatch.setattr(email, "send_verification_email", lambda to, link: True)

    r = _register(client, email="locked@example.com")
    assert r.json()["email_verified"] is False

    user = _get_user(db_session, email="locked@example.com")
    token = create_reset_token(user.id, user.hashed_password)
    reset = client.post("/auth/reset-password", json={"token": token, "password": "freshpass123"})
    assert reset.status_code == 200

    # Redeeming a link mailed to the address proves inbox ownership, so the
    # account is now verified and login works.
    assert _login(client, email="locked@example.com", password="freshpass123").status_code == 200
