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


class GeocodeCandidate(BaseModel):
    label: str  # display name, e.g. "Waterloo, Ontario, CA"
    lat: float
    lon: float


# US state names/codes for query targeting. OpenWeather's geocoder returns at
# most 5 places and its state filter ("city,VA,US") is US-only, so a state
# suffix typed in prose ("springfield virginia") must be converted or the
# right city may never appear among the five.
_US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}
_STATE_CODES = set(_US_STATES.values())


def _query_variants(query: str) -> list:
    """Query forms to try in order: state-targeted first, then the raw text.

    "springfield virginia" / "Springfield, VA" -> "springfield,VA,US" before
    the raw string. Queries with no recognizable US state suffix (or where
    the whole query IS the state name, like "new york" the city) pass
    through untouched.
    """
    q = " ".join(query.split()).strip().strip(",")
    variants = []
    if "," in q:
        city, _, rest = q.partition(",")
        city, rest = city.strip(), rest.strip().lower()
        code = _US_STATES.get(rest) or (rest.upper() if rest.upper() in _STATE_CODES else None)
        if city and code:
            variants.append(f"{city},{code},US")
    else:
        words = q.split(" ")
        for n in (3, 2, 1):  # longest state names first ("district of columbia")
            if len(words) > n:  # the city part must stay non-empty
                tail = " ".join(words[-n:]).lower()
                code = _US_STATES.get(tail) or (
                    tail.upper() if n == 1 and tail.upper() in _STATE_CODES else None
                )
                if code:
                    variants.append(f"{' '.join(words[:-n])},{code},US")
                    break
    variants.append(query)
    return variants


def geocode_candidates(query: str, limit: int = 5) -> list:
    """Look up up to `limit` places matching a city name.

    Same-named cities exist worldwide (Waterloo ON vs Waterloo IA), so the
    picker must offer every candidate rather than guessing. Returns [] when
    nothing matches; raises WeatherServiceError on config/network problems.
    """
    settings = get_settings()
    if not settings.openweather_api_key:
        raise WeatherServiceError("OpenWeather API key is not configured")

    results = []
    for candidate_query in _query_variants(query):
        params = {"q": candidate_query, "limit": limit, "appid": settings.openweather_api_key}
        try:
            resp = httpx.get(_OWM_GEO_URL, params=params, timeout=10.0)
            resp.raise_for_status()
            results = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise WeatherServiceError(f"Failed to look up location: {exc}") from exc
        if results:
            break

    candidates = []
    for place in results or []:
        name = str(place.get("name", query))
        label = ", ".join(
            str(p) for p in [name, place.get("state"), place.get("country")] if p
        )
        candidates.append(
            GeocodeCandidate(label=label, lat=float(place["lat"]), lon=float(place["lon"]))
        )
    return candidates


def geocode(query: str) -> GeocodeResult:
    """Resolve a city name to its top geocoding hit.

    Raises WeatherServiceError if no key is configured, the lookup fails, or
    the place is unknown.
    """
    candidates = geocode_candidates(query, limit=1)
    if not candidates:
        raise WeatherServiceError(f"Could not find a place called {query!r}")
    top = candidates[0]
    return GeocodeResult(name=top.label, lat=top.lat, lon=top.lon)
