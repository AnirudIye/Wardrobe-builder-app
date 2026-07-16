import { useEffect, useState } from "react";
import { api, ApiError, BuyNext as BuyNextData } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { ListSkeleton } from "../components/Skeleton";
import ErrorNote from "../components/ErrorNote";

// Session cache: switching tabs shows the last result instantly instead of
// burning another quota-counted request. "Refresh" forces a new one.
// The in-flight promise also guards against double-fired effects (React
// StrictMode mounts twice in dev) so auto-load never burns quota twice.
let cached: BuyNextData | null = null;
let inflight: Promise<BuyNextData> | null = null;

// Read-only peek for other tabs (e.g. TryOn, which offers Buy Next products
// as try-on candidates) — never triggers a fetch itself.
export function getCachedBuyNext(): BuyNextData | null {
  return cached;
}

// Shared fetch for any tab that wants Buy Next data. Serves the session cache
// unless forced, and dedupes concurrent callers through the same in-flight
// promise so a quota-counted request is never double-fired.
export function fetchBuyNext(force = false): Promise<BuyNextData> {
  if (!force && cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .buyNext()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export default function BuyNext({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const [data, setData] = useState<BuyNextData | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pageRef = useFadeRise<HTMLDivElement>();
  const listRef = useStaggerReveal<HTMLDivElement>(data ? data.suggestions.length : null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchBuyNext(true);
      setData(result);
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

  // Auto-load on first open (no click needed); reuse the cache afterwards.
  useEffect(() => {
    if (!cached) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={pageRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">What to buy next</h2>
        <button onClick={generate} disabled={busy} className="clay-btn px-5 py-2 text-sm">
          {busy ? "Finding…" : data ? "Refresh" : "Get suggestions"}
        </button>
      </div>

      {busy && !data && <ListSkeleton count={3} height="h-32" />}
      <ErrorNote message={error} className="mb-4" />

      <div ref={listRef} className="space-y-5">
        {data?.suggestions.map((s, i) => (
          <div key={i} className="clay-card p-6">
            <h3 className="font-semibold capitalize">{s.description}</h3>
            <p className="text-sm text-navy/50 mt-1">{s.rationale}</p>
            {s.products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                {s.products.map((p, j) => (
                  <a
                    key={j}
                    href={p.link ?? s.search_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="clay-card clay-card-hover p-3"
                  >
                    {p.thumbnail && (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="w-full aspect-square object-contain rounded-xl"
                      />
                    )}
                    <p className="text-xs mt-2 line-clamp-2">{p.title}</p>
                    {p.price && <p className="text-xs font-semibold mt-0.5">{p.price}</p>}
                    {p.source && <p className="text-[10px] text-navy/40">{p.source}</p>}
                  </a>
                ))}
              </div>
            )}
            {s.search_url && (
              <a
                href={s.search_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4 text-sm underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                Shop more like this on Google Shopping →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
