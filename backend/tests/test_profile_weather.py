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


def test_query_variants_city_plus_state_name():
    # OpenWeather's geocoder caps at 5 results, so "springfield virginia"
    # must become the targeted "city,VA,US" form or the right Springfield
    # never appears among the five returned.
    assert weather._query_variants("springfield virginia") == [
        "springfield,VA,US",
        "springfield virginia",
    ]


def test_query_variants_comma_and_code_forms():
    assert weather._query_variants("Springfield, Virginia")[0] == "Springfield,VA,US"
    assert weather._query_variants("springfield va")[0] == "springfield,VA,US"
    assert weather._query_variants("Springfield, VA")[0] == "Springfield,VA,US"


def test_query_variants_multiword_states():
    assert weather._query_variants("buffalo new york")[0] == "buffalo,NY,US"
    assert weather._query_variants("washington district of columbia")[0] == "washington,DC,US"


def test_query_variants_plain_and_ambiguous_queries_stay_raw():
    assert weather._query_variants("waterloo") == ["waterloo"]
    # "new york" typed alone is the city, not an empty city in NY state.
    assert weather._query_variants("new york") == ["new york"]
    assert weather._query_variants("paris, france") == ["paris, france"]


def test_geocode_candidates_prefers_state_variant(monkeypatch: pytest.MonkeyPatch):
    calls = []

    class _Resp:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            pass

        def json(self):
            return self._payload

    def fake_get(url, params=None, timeout=None):
        calls.append(params["q"])
        if params["q"] == "springfield,VA,US":
            return _Resp([{"name": "Springfield", "state": "Virginia", "country": "US", "lat": 38.78, "lon": -77.18}])
        return _Resp([])

    monkeypatch.setattr(weather.httpx, "get", fake_get)
    monkeypatch.setattr(weather.get_settings(), "openweather_api_key", "test-key")
    found = weather.geocode_candidates("springfield virginia")
    assert calls == ["springfield,VA,US"]  # raw fallback never needed
    assert [c.label for c in found] == ["Springfield, Virginia, US"]


def test_geocode_candidates_falls_back_to_raw_query(monkeypatch: pytest.MonkeyPatch):
    calls = []

    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            # State-targeted form finds nothing; raw query does.
            if calls[-1] == "georgia":
                return [{"name": "Georgia", "country": "GE", "lat": 42.0, "lon": 43.5}]
            return []

    def fake_get(url, params=None, timeout=None):
        calls.append(params["q"])
        return _Resp()

    monkeypatch.setattr(weather.httpx, "get", fake_get)
    monkeypatch.setattr(weather.get_settings(), "openweather_api_key", "test-key")
    found = weather.geocode_candidates("georgia")
    assert found and found[0].label == "Georgia, GE"


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
