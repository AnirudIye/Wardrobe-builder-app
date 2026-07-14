from __future__ import annotations

import time
from typing import Dict, Optional, Tuple

import httpx
from pydantic import BaseModel

from app.config import get_settings

_CACHE_TTL_SECONDS = 1800  # 30 minutes
_OWM_URL = "https://api.openweathermap.org/data/2.5/weather"
_OWM_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct"

# (rounded_lat, rounded_lon) -> (fetched_at, snapshot)
_cache: Dict[Tuple[float, float], Tuple[float, "WeatherSnapshot"]] = {}


class WeatherServiceError(RuntimeError):
    """Raised when weather cannot be fetched (missing key or upstream failure)."""


class WeatherSnapshot(BaseModel):
    temp_c: float
    feels_like_c: float
    condition: str  # short label e.g. "Rain"
    description: str  # e.g. "light rain"
    wind_kph: float
    humidity: int


def _cache_key(lat: float, lon: float) -> Tuple[float, float]:
    return (round(lat, 2), round(lon, 2))


def get_weather(lat: float, lon: float) -> WeatherSnapshot:
    """Fetch current weather for a coordinate, cached ~30 min per location.

    Raises WeatherServiceError if no API key is configured or the call fails.
    """
    settings = get_settings()
    if not settings.openweather_api_key:
        raise WeatherServiceError("OpenWeather API key is not configured")

    key = _cache_key(lat, lon)
    now = time.monotonic()
    cached = _cache.get(key)
    if cached is not None and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.openweather_api_key,
        "units": "metric",
    }
    try:
        resp = httpx.get(_OWM_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        weather0 = (data.get("weather") or [{}])[0]
        main = data.get("main") or {}
        wind = data.get("wind") or {}
        snapshot = WeatherSnapshot(
            temp_c=float(main.get("temp", 0.0)),
            feels_like_c=float(main.get("feels_like", main.get("temp", 0.0))),
            condition=str(weather0.get("main", "Unknown")),
            description=str(weather0.get("description", "")),
            wind_kph=round(float(wind.get("speed", 0.0)) * 3.6, 1),
            humidity=int(main.get("humidity", 0)),
        )
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise WeatherServiceError(f"Failed to fetch weather: {exc}") from exc

    _cache[key] = (now, snapshot)
    return snapshot


def clear_cache() -> None:
    _cache.clear()


class GeocodeResult(BaseModel):
    name: str  # resolved display name, e.g. "London, GB"
    lat: float
    lon: float


def geocode(query: str) -> GeocodeResult:
    """Resolve a city name to coordinates via OpenWeather's geocoding API.

    Raises WeatherServiceError if no key is configured, the lookup fails, or
    the place is unknown.
    """
    settings = get_settings()
    if not settings.openweather_api_key:
        raise WeatherServiceError("OpenWeather API key is not configured")

    params = {"q": query, "limit": 1, "appid": settings.openweather_api_key}
    try:
        resp = httpx.get(_OWM_GEO_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        results = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise WeatherServiceError(f"Failed to look up location: {exc}") from exc

    if not results:
        raise WeatherServiceError(f"Could not find a place called {query!r}")

    top = results[0]
    name = str(top.get("name", query))
    state = top.get("state")
    country = top.get("country")
    display = ", ".join(p for p in [name, state, country] if p)
    return GeocodeResult(name=display, lat=float(top["lat"]), lon=float(top["lon"]))
