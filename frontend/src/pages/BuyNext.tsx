import { useState } from "react";
import { api, ApiError, BuyNext as BuyNextData } from "../api";

export default function BuyNext({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const [data, setData] = useState<BuyNextData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await api.buyNext());
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
        <h2 className="text-xl font-semibold">What to buy next</h2>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Finding…" : "Get suggestions"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="space-y-4">
        {data?.suggestions.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-medium capitalize">{s.description}</h3>
            <p className="text-sm text-neutral-500 mt-1">{s.rationale}</p>
            {s.products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                {s.products.map((p, j) => (
                  <a
                    key={j}
                    href={p.link ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-neutral-200 rounded-lg p-2 hover:shadow"
                  >
                    {p.thumbnail && (
                      <img src={p.thumbnail} alt="" className="w-full aspect-square object-contain" />
                    )}
                    <p className="text-xs mt-1 line-clamp-2">{p.title}</p>
                    {p.price && <p className="text-xs font-medium">{p.price}</p>}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
