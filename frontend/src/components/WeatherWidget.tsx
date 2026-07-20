// Small weather widget: user's city, current conditions, a mini map, and an
// inline "change location" flow. Typing a city lists every matching place
// (same-named cities exist worldwide) and the user picks the right one.
import { useEffect, useState } from "react";
import { api, LocationCandidate, User, Weather } from "../api";
import { useFadeRise } from "../animations";
import { Skeleton } from "../components/Skeleton";
import { profileCache, weatherCache } from "../store";
import ErrorNote from "./ErrorNote";

export default function WeatherWidget() {
  const cardRef = useFadeRise<HTMLDivElement>();
  const [profile, setProfile] = useState<User | null>(profileCache.peek());
  const [weather, setWeather] = useState<Weather | null>(weatherCache.peek());
  const [loading, setLoading] = useState(profileCache.peek() === null);
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState("");
  const [candidates, setCandidates] = useState<LocationCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeather = async (p: User, force = false) => {
    if (p.lat == null || p.lon == null) return;
    try {
      setWeather(await weatherCache.get(force));
    } catch {
      setWeather(null); // weather is best-effort (e.g. no API key)
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await profileCache.get();
        setProfile(p);
        setLoading(false);
        await loadWeather(p);
      } catch {
        setLoading(false); // profile load is non-critical for the wardrobe page
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyLocation = async (label: string, lat?: number, lon?: number) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setLocation(label, lat, lon);
      profileCache.set(updated);
      setProfile(updated);
      setEditing(false);
      setCity("");
      setCandidates(null);
      weatherCache.clear();
      setWeather(null);
      await loadWeather(updated, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Search first; save directly only when the name is unambiguous.
  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setCandidates(null);
    try {
      const found = await api.searchLocations(city.trim());
      if (found.length === 0) {
        setError(`Couldn't find a place called "${city.trim()}".`);
      } else if (found.length === 1) {
        await applyLocation(found[0].label, found[0].lat, found[0].lon);
      } else {
        setCandidates(found);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hasLocation = profile?.lat != null && profile?.lon != null;
  const lat = profile?.lat ?? 0;
  const lon = profile?.lon ?? 0;
  // Small bounding box around the point for the embedded map.
  const bbox = `${lon - 0.06},${lat - 0.035},${lon + 0.06},${lat + 0.035}`;

  if (loading) {
    return (
      <div ref={cardRef} className="clay-card p-5 mb-6 space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="w-full h-36" />
      </div>
    );
  }

  return (
    <div ref={cardRef} className="clay-card p-5 mb-6">
      {/* Always stacked: this widget lives in the ~300px wardrobe rail, where
          a viewport-keyed sm:flex-row squeezed the text to nothing beside a
          fixed-width map. The map sits full-width below the text instead. */}
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Your weather</h3>
            <button
              onClick={() => {
                setEditing((v) => !v);
                setError(null);
                setCandidates(null);
              }}
              className="clay-btn-blush px-3 py-1 text-xs"
            >
              {editing ? "Cancel" : hasLocation ? "Change location" : "Set location"}
            </button>
          </div>

          {editing ? (
            <div className="mt-3">
              <form onSubmit={searchCity} className="flex gap-2">
                <input
                  autoFocus
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCandidates(null);
                  }}
                  placeholder="City, e.g. Waterloo"
                  // min-w-0 beats the input's intrinsic ~190px floor - without
                  // it the narrow rail pushes the Search button out through
                  // the card's right padding (same fix as the wardrobe search).
                  className="flex-1 min-w-0 clay-input px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || city.trim().length < 2}
                  className="clay-btn px-4 py-1.5 text-sm shrink-0"
                >
                  {busy ? "…" : "Search"}
                </button>
              </form>
              {candidates && (
                <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto overscroll-contain">
                  <p className="text-xs text-navy/50">Which one?</p>
                  {candidates.map((c) => (
                    <button
                      key={`${c.lat},${c.lon}`}
                      onClick={() => applyLocation(c.label, c.lat, c.lon)}
                      disabled={busy}
                      className="block w-full text-left text-sm px-3 py-1.5 rounded-xl bg-cream hover:bg-blush-soft/60 transition-colors"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : hasLocation ? (
            <div className="mt-2">
              <p className="font-brand text-2xl leading-tight">{profile?.city ?? "Your city"}</p>
              {weather ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="clay-chip">{Math.round(weather.temp_c)}°C</span>
                  <span className="clay-chip capitalize">{weather.description}</span>
                  <span className="clay-chip">feels {Math.round(weather.feels_like_c)}°C</span>
                  <span className="clay-chip inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" />
                      <path d="M3 16h13a2.5 2.5 0 1 1-2.5 2.5" />
                      <path d="M3 12h6" />
                    </svg>
                    {Math.round(weather.wind_kph)} km/h
                  </span>
                </div>
              ) : (
                <p className="text-sm text-navy/50 mt-2">Weather unavailable right now.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-navy/50 mt-2">
              Set your city to get weather-aware outfit recommendations.
            </p>
          )}
          <ErrorNote message={error} className="mt-2" />
        </div>

        {hasLocation && (
          <div className="w-full h-36 rounded-2xl overflow-hidden shadow-clay-sm">
            <iframe
              title="Location map"
              className="w-full h-full border-0"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
