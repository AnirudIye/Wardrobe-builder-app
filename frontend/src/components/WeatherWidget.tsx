// Small weather widget: user's city, current conditions, a mini map, and an
// inline "change location" flow (city name -> geocoded server-side).
import { useEffect, useState } from "react";
import { api, User, Weather } from "../api";
import { useFadeRise } from "../animations";

export default function WeatherWidget() {
  const cardRef = useFadeRise<HTMLDivElement>();
  const [profile, setProfile] = useState<User | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeather = async (p: User) => {
    if (p.lat == null || p.lon == null) return;
    try {
      setWeather(await api.weather());
    } catch {
      setWeather(null); // weather is best-effort (e.g. no API key)
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await api.profile();
        setProfile(p);
        await loadWeather(p);
      } catch {
        /* profile load is non-critical for the wardrobe page */
      }
    })();
  }, []);

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setLocation(city.trim());
      setProfile(updated);
      setEditing(false);
      setCity("");
      setWeather(null);
      await loadWeather(updated);
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

  return (
    <div ref={cardRef} className="clay-card p-5 mb-6">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Your weather</h3>
            <button
              onClick={() => {
                setEditing((v) => !v);
                setError(null);
              }}
              className="clay-btn-blush px-3 py-1 text-xs"
            >
              {editing ? "Cancel" : hasLocation ? "Change location" : "Set location"}
            </button>
          </div>

          {editing ? (
            <form onSubmit={saveLocation} className="mt-3 flex gap-2">
              <input
                autoFocus
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City, e.g. Waterloo"
                className="flex-1 clay-input px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy || city.trim().length < 2}
                className="clay-btn px-4 py-1.5 text-sm"
              >
                {busy ? "…" : "Save"}
              </button>
            </form>
          ) : hasLocation ? (
            <div className="mt-2">
              <p className="font-brand text-2xl leading-tight">{profile?.city ?? "Your city"}</p>
              {weather ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="clay-chip">{Math.round(weather.temp_c)}°C</span>
                  <span className="clay-chip capitalize">{weather.description}</span>
                  <span className="clay-chip">feels {Math.round(weather.feels_like_c)}°C</span>
                  <span className="clay-chip">💨 {Math.round(weather.wind_kph)} km/h</span>
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
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        {hasLocation && (
          <div className="sm:w-64 h-36 rounded-2xl overflow-hidden shadow-clay-sm shrink-0">
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
