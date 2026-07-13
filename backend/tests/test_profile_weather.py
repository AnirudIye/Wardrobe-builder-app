from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services import weather
from app.services.weather import WeatherSnapshot
from tests.helpers import auth_headers


def test_profile_defaults_then_update(client: TestClient):
    headers = auth_headers(client)
    assert client.get("/profile", headers=headers).json()["city"] is None

    resp = client.patch(
        "/profile",
        headers=headers,
        json={"city": "London", "lat": 51.5, "lon": -0.12, "style_preferences": {"styles": ["minimal"]}},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["city"] == "London"
    assert body["lat"] == 51.5
    assert body["style_preferences"] == {"styles": ["minimal"]}


def test_profile_rejects_bad_coords(client: TestClient):
    headers = auth_headers(client)
    assert client.patch("/profile", headers=headers, json={"lat": 999}).status_code == 422


def test_weather_requires_location(client: TestClient):
    headers = auth_headers(client)
    resp = client.get("/weather", headers=headers)
    assert resp.status_code == 400


def test_weather_uses_mocked_service(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    snapshot = WeatherSnapshot(
        temp_c=8.0, feels_like_c=6.0, condition="Clouds",
        description="broken clouds", wind_kph=12.0, humidity=70,
    )
    monkeypatch.setattr(weather, "get_weather", lambda lat, lon: snapshot)

    headers = auth_headers(client)
    resp = client.get("/weather?lat=51.5&lon=-0.12", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["condition"] == "Clouds"
    assert resp.json()["temp_c"] == 8.0
