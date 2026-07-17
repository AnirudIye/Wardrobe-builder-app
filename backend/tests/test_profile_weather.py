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


def test_set_location_geocodes_city(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        weather,
        "geocode",
        lambda q: weather.GeocodeResult(name="Waterloo, ON, CA", lat=43.46, lon=-80.52),
    )
    headers = auth_headers(client)
    resp = client.post("/profile/location", headers=headers, json={"city": "waterloo"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["city"] == "Waterloo, ON, CA"
    assert body["lat"] == 43.46
    assert body["lon"] == -80.52

    # Persisted on the profile.
    assert client.get("/profile", headers=headers).json()["city"] == "Waterloo, ON, CA"


def test_set_location_unknown_city_400(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    def _boom(q):
        raise weather.WeatherServiceError(f"Could not find a place called {q!r}")

    monkeypatch.setattr(weather, "geocode", _boom)
    headers = auth_headers(client)
    resp = client.post("/profile/location", headers=headers, json={"city": "Atlantis"})
    assert resp.status_code == 400
    assert "Atlantis" in resp.json()["detail"]


def test_geocode_without_key_raises():
    with pytest.raises(weather.WeatherServiceError):
        weather.geocode("London")


def test_location_search_returns_candidates(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        weather,
        "geocode_candidates",
        lambda q, limit=5: [
            weather.GeocodeCandidate(label="Waterloo, Ontario, CA", lat=43.46, lon=-80.52),
            weather.GeocodeCandidate(label="Waterloo, Iowa, US", lat=42.49, lon=-92.34),
        ],
    )
    headers = auth_headers(client)
    resp = client.get("/profile/location/search?q=waterloo", headers=headers)
    assert resp.status_code == 200, resp.text
    labels = [c["label"] for c in resp.json()]
    assert labels == ["Waterloo, Ontario, CA", "Waterloo, Iowa, US"]


def test_location_search_without_key_400(client: TestClient):
    # conftest blanks the OpenWeather key, so the real service raises -> 400.
    headers = auth_headers(client)
    assert client.get("/profile/location/search?q=london", headers=headers).status_code == 400


def test_set_location_with_explicit_coordinates_skips_geocoding(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    def _boom(q):
        raise AssertionError("geocode must not be called when coordinates are supplied")

    monkeypatch.setattr(weather, "geocode", _boom)
    headers = auth_headers(client)
    resp = client.post(
        "/profile/location",
        headers=headers,
        json={"city": "Waterloo, Ontario, CA", "lat": 43.46, "lon": -80.52},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["city"] == "Waterloo, Ontario, CA"
    assert body["lat"] == 43.46
    assert body["lon"] == -80.52
