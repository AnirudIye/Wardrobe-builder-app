import { useEffect, useState } from "react";
import { api, OutfitRecommendation } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { CardGridSkeleton, Skeleton } from "../components/Skeleton";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Wardrobe as WardrobeIll } from "../components/illustrations";

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

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Today's Recommendations"
        context={
          rec?.weather
            ? `${dateLine} · ${Math.round(rec.weather.temp_c)}°C, ${rec.weather.description}`
            : dateLine
        }
        action={
          <button onClick={generate} disabled={busy} className="clay-btn px-5 py-2 text-sm">
            {busy ? "Thinking…" : rec ? "Refresh" : "Get recommendation"}
          </button>
        }
      />

      {busy && !rec && (
        <div className="clay-card blob-card-b p-8">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-4 w-3/4 mb-6" />
          <CardGridSkeleton count={4} cols="grid-cols-2 sm:grid-cols-4" />
        </div>
      )}
      <ErrorNote message={error} className="mb-4" />

      {rec && rec.items.length === 0 && !busy && (
        <EmptyState
          Ill={WardrobeIll}
          title="Nothing to style yet"
          body="Add a few pieces to your wardrobe first. Once your closet has tops, bottoms and shoes, a full look appears here every morning."
        />
      )}

      {rec && rec.items.length > 0 && (
        <div className="clay-card blob-card-b overflow-hidden">
          <div className="p-6 sm:p-9 grid lg:grid-cols-5 gap-8 lg:gap-10 items-center">
            {/* The reasoning reads like a stylist's note, not metadata. */}
            <div className="lg:col-span-2">
              <p className="text-lg text-navy/80 leading-relaxed">{rec.rationale}</p>
              <p className="text-xs text-navy/40 mt-5">
                {rec.source === "ai" ? "Styled by DresserAI" : "Styled by house rules"}
                {rec.weather ? ` · ${Math.round(rec.weather.temp_c)}°C ${rec.weather.description}` : ""}
              </p>
            </div>
            <div ref={itemsRef} className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4">
              {rec.items.map((g) => (
                <div key={g.id} className="clay-card clay-card-hover overflow-hidden">
                  <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                  <p className="text-xs px-3 py-2.5 text-navy/70 font-medium capitalize">
                    {g.subcategory ?? g.category ?? "item"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
