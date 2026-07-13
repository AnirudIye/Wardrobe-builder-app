import { useState } from "react";
import { api, ApiError, OutfitRecommendation } from "../api";

export default function Today({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const [rec, setRec] = useState<OutfitRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setRec(await api.today());
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        onQuotaBlocked();
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">What to wear today</h2>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Get recommendation"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {rec && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          {rec.weather && (
            <p className="text-sm text-neutral-500 mb-2">
              {Math.round(rec.weather.temp_c)}°C · {rec.weather.description}
            </p>
          )}
          <p className="mb-4">{rec.rationale}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {rec.items.map((g) => (
              <div key={g.id} className="rounded-lg overflow-hidden border border-neutral-200">
                <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                <p className="text-xs p-2 text-neutral-600">{g.category ?? "item"}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-3">Source: {rec.source}</p>
        </div>
      )}
    </div>
  );
}
