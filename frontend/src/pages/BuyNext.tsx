import { useEffect, useState } from "react";
import { api, ApiError, BuyNext as BuyNextData } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";

// Session cache: switching tabs shows the last result instantly instead of
// burning another quota-counted request. "Refresh" forces a new one.
// The in-flight promise also guards against double-fired effects (React
// StrictMode mounts twice in dev) so auto-load never burns quota twice.
let cached: BuyNextData | null = null;
let inflight: Promise<BuyNextData> | null = null;

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
      if (!inflight) {
        inflight = api.buyNext().finally(() => {
          inflight = null;
        });
      }
      const result = await inflight;
      cached = result;
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
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-neutral-700 transition-colors"
        >
          {busy ? "Finding…" : data ? "Refresh" : "Get suggestions"}
        </button>
      </div>

      {busy && !data && <p className="text-neutral-500 mb-4">Analyzing your wardrobe gaps…</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div ref={listRef} className="space-y-4">
        {data?.suggestions.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-medium capitalize">{s.description}</h3>
            <p className="text-sm text-neutral-500 mt-1">{s.rationale}</p>
            {s.products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                {s.products.map((p, j) => (
                  <a
                    key={j}
                    href={p.link ?? s.search_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-neutral-200 rounded-lg p-2 hover:shadow transition-shadow"
                  >
                    {p.thumbnail && (
                      <img src={p.thumbnail} alt="" className="w-full aspect-square object-contain" />
                    )}
                    <p className="text-xs mt-1 line-clamp-2">{p.title}</p>
                    {p.price && <p className="text-xs font-medium">{p.price}</p>}
                    {p.source && <p className="text-[10px] text-neutral-400">{p.source}</p>}
                  </a>
                ))}
              </div>
            )}
            {s.search_url && (
              <a
                href={s.search_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-3 text-sm underline text-neutral-700 hover:text-neutral-900"
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
