import { useEffect, useState } from "react";
import { api, ApiError, BuyNext as BuyNextData, Product } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { ListSkeleton } from "../components/Skeleton";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Bag } from "../components/illustrations";

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

// SerpAPI prices are display strings ("$49.99", "CA$60.00"); parse best-effort.
function parsePrice(p: Product): number | null {
  if (!p.price) return null;
  const n = parseFloat(p.price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const PRICE_CAPS = [25, 50, 100, 200];

export default function BuyNext({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const [data, setData] = useState<BuyNextData | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  // Client-side filter: the suggestion (the reasoning) always stays; only the
  // shoppable picks narrow. Unknown prices are hidden once a cap is set.
  const visibleProducts = (products: Product[]) =>
    maxPrice === null
      ? products
      : products.filter((p) => {
          const n = parsePrice(p);
          return n !== null && n <= maxPrice;
        });

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
      <PageHeader
        title="What To Buy Next"
        context="Gap analysis of your closet, with real products. Five runs a day on the free plan."
        action={
          <button onClick={generate} disabled={busy} className="clay-btn px-5 py-2 text-sm">
            {busy ? "Finding…" : data ? "Refresh" : "Get suggestions"}
          </button>
        }
      />

      {data && data.suggestions.some((s) => s.products.length > 0) && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs font-medium text-navy/50">Price:</span>
          <button
            onClick={() => setMaxPrice(null)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              maxPrice === null ? "bg-navy text-cream" : "bg-cream text-navy/60 hover:text-navy"
            }`}
          >
            Any
          </button>
          {PRICE_CAPS.map((cap) => (
            <button
              key={cap}
              onClick={() => setMaxPrice(cap)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                maxPrice === cap ? "bg-navy text-cream" : "bg-cream text-navy/60 hover:text-navy"
              }`}
            >
              Under ${cap}
            </button>
          ))}
        </div>
      )}

      {busy && !data && <ListSkeleton count={3} height="h-32" />}
      <ErrorNote message={error} className="mb-4" />

      {data && data.suggestions.length === 0 && !busy && (
        <EmptyState
          Ill={Bag}
          title="Nothing missing yet"
          body="Your closet is either brand new or remarkably complete. Add more pieces to My Wardrobe and the gap analysis gets sharper."
        />
      )}

      <div ref={listRef} className="space-y-8">
        {data?.suggestions.map((s, i) => (
          <article key={i} className="clay-card blob-card-b p-6 sm:p-8">
            {/* The reasoning is the product: give it editorial weight. */}
            <div className="max-w-2xl">
              <h3 className="font-brand text-2xl sm:text-3xl tracking-tight capitalize">{s.description}</h3>
              <p className="text-navy/60 mt-2 leading-relaxed">{s.rationale}</p>
            </div>
            {s.products.length > 0 && visibleProducts(s.products).length === 0 && (
              <p className="text-sm text-navy/40 mt-4">
                No picks under ${maxPrice} for this one. Raise the price filter or use the
                search link below.
              </p>
            )}
            {visibleProducts(s.products).length > 0 && (
              <div className="flex gap-4 mt-6 overflow-x-auto pb-2 -mx-1 px-1">
                {visibleProducts(s.products).map((p, j) => (
                  <a
                    key={j}
                    href={p.link ?? s.search_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="clay-card clay-card-hover p-3 w-40 shrink-0"
                  >
                    {p.thumbnail && (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="w-full aspect-square object-contain rounded-xl bg-white"
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
          </article>
        ))}
      </div>
    </div>
  );
}
