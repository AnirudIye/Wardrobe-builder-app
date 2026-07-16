from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings


def test_security_headers_present(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert resp.headers["X-Frame-Options"] == "DENY"
    # Camera stays allowed for same-origin — TryOn uses getUserMedia.
    assert "camera=(self)" in resp.headers["Permissions-Policy"]


def test_no_hsts_in_dev(client: TestClient):
    # HSTS from a plain-HTTP dev server would poison localhost for everything.
    resp = client.get("/health")
    assert "Strict-Transport-Security" not in resp.headers


def test_docs_available_in_dev(client: TestClient):
    assert client.get("/openapi.json").status_code == 200


# Posture is validated at the Settings level (the app instance is import-time
# constructed with dev settings; booting a "production" app in tests would
# fight the lru_cache). _env_file=None keeps the developer's real .env out.

def _prod_settings(**overrides) -> Settings:
    values = dict(
        environment="production",
        jwt_secret="x" * 40,
        cors_origins="https://app.example.com",
    )
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_rejects_placeholder_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET"):
        _prod_settings(jwt_secret="dev-insecure-secret-change-me")


def test_production_rejects_short_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET"):
        _prod_settings(jwt_secret="short")


def test_production_requires_cors_origins():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        _prod_settings(cors_origins="")


def test_valid_production_settings_pass():
    s = _prod_settings()
    assert s.is_production
    assert s.cors_origin_list == ["https://app.example.com"]


def test_s3_backend_requires_bucket_and_public_url():
    with pytest.raises(ValueError, match="S3_BUCKET"):
        Settings(_env_file=None, storage_backend="s3")


def test_cors_origin_list_parses_and_falls_back():
    s = Settings(_env_file=None, cors_origins="https://a.com, https://b.com")
    assert s.cors_origin_list == ["https://a.com", "https://b.com"]
    assert Settings(_env_file=None).cors_origin_list == ["http://localhost:5173"]
