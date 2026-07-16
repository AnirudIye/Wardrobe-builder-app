import { useEffect, useState } from "react";
import { api, OutfitRecommendation } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { CardGridSkeleton, Skeleton } from "../components/Skeleton";
import ErrorNote from "../components/ErrorNote";

// Session cache: switching tabs shows the last result instantly instead of
// re-fetching. "Refresh" forces a new one. The in-flight promise also guards
// against double-fired effects (React StrictMode mounts twice in dev).
let cached: OutfitRecommendation | null = null;
let inflight: Promise<OutfitRecommendation> | null = null;

export default function Today() {
  const [rec, setRec] = useState<OutfitRecommendation | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pageRef = useFadeRise<HTMLDivElement>();
  const itemsRef = useStaggerReveal<HTMLDivElement>(rec ? rec.rationale : null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!inflight) {
        inflight = api.today().finally(() => {
          inflight = null;
        });
      }
      const result = await inflight;
      cached = result;
      setRec(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Auto-load on first open (no click needed); reuse the cache afterwards.
  useEffect(() => {
    if (!cached) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={pageRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">What to wear today</h2>
        <button onClick={generate} disabled={busy} className="clay-btn px-5 py-2 text-sm">
          {busy ? "Thinking…" : rec ? "Refresh" : "Get recommendation"}
        </button>
      </div>

      {busy && !rec && (
        <div className="clay-card p-6">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-4 w-3/4 mb-5" />
          <CardGridSkeleton count={4} cols="grid-cols-2 sm:grid-cols-4" />
        </div>
      )}
      <ErrorNote message={error} className="mb-4" />

      {rec && (
        <div className="clay-card p-6">
          {rec.weather && (
            <span className="clay-chip inline-block mb-3">
              {Math.round(rec.weather.temp_c)}°C · {rec.weather.description}
            </span>
          )}
          <p className="mb-5">{rec.rationale}</p>
          <div ref={itemsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {rec.items.map((g) => (
              <div key={g.id} className="clay-card clay-card-hover overflow-hidden">
                <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                <p className="text-xs p-2.5 text-navy/70 font-medium">
                  {g.subcategory ?? g.category ?? "item"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-navy/40 mt-4">Source: {rec.source}</p>
        </div>
      )}
    </div>
  );
}
