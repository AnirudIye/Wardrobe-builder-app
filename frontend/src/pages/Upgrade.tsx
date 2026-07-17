import { useEffect, useState } from "react";
import { api, BillingStatus } from "../api";
import { useFadeRise } from "../animations";
import { Skeleton } from "../components/Skeleton";
import { billingCache } from "../store";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";

// A labelled usage meter bound to real quota state — never decorative.
function Meter({
  label,
  remaining,
  limit,
  period,
}: {
  label: string;
  remaining: number | null;
  limit: number;
  period: string;
}) {
  if (remaining === null) return null; // unlimited (paid) — no meter to show
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-navy/50 whitespace-nowrap">
          {remaining} of {limit} left {period}
        </span>
      </div>
      <div className="h-2.5 mt-1.5 rounded-full bg-cream-deep overflow-hidden">
        <div
          className="h-full rounded-full bg-blush-deep transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Upgrade() {
  const pageRef = useFadeRise<HTMLDivElement>();
  const [status, setStatus] = useState<BillingStatus | null>(billingCache.peek());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Refresh in the background even when cached — quotas change as other
    // tabs consume them — but render the cached value immediately.
    billingCache.get(true).then(setStatus);
  }, []);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.checkout();
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.portal();
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!status)
    return (
      <div>
        <PageHeader title="Your Plan" />
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <div className="clay-card p-7 space-y-4">
            <Skeleton className="h-9 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="clay-card p-7 space-y-5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    );

  const isPaid = status.plan === "paid";

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Your Plan"
        context="Outfit recommendations are always free and unlimited, whatever the plan."
      />

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl items-start">
        {/* Plan card */}
        <div
          className={`clay-card blob-card-a p-7 ${
            isPaid ? "bg-navy text-cream shadow-clay-navy" : ""
          }`}
        >
          <p className="font-brand text-3xl tracking-tight">
            {isPaid ? "BetterDresser Plus" : "Free plan"}
          </p>
          <p className={`text-sm mt-2 ${isPaid ? "text-cream/70" : "text-navy/50"}`}>
            {isPaid
              ? "Unlimited Buy Next suggestions, DresserAI messages and try-ons. Thanks for supporting BetterDresser."
              : "A daily Buy Next allowance plus weekly DresserAI and TryOn credits. Plus lifts every cap for $5 a month."}
          </p>
          <ErrorNote message={error} className="mt-4" />
          {isPaid ? (
            <button
              onClick={openPortal}
              disabled={busy}
              className="clay-btn-blush px-5 py-2.5 text-sm mt-6"
            >
              Manage subscription
            </button>
          ) : (
            <button onClick={startCheckout} disabled={busy} className="w-full clay-btn py-3 mt-6">
              {busy ? "Redirecting…" : "Upgrade to Plus for $5/month"}
            </button>
          )}
        </div>

        {/* Live allowance meters (free plan only) */}
        {!isPaid && (
          <div className="clay-card blob-card-c p-7 space-y-5">
            <h3 className="font-semibold">Your allowance right now</h3>
            <Meter
              label="What To Buy Next"
              remaining={status.remaining_today}
              limit={status.daily_limit}
              period="today"
            />
            <Meter
              label="DresserAI messages"
              remaining={status.chat_remaining_this_week}
              limit={status.chat_weekly_limit}
              period="this week"
            />
            <Meter
              label="Virtual try-ons"
              remaining={status.tryon_remaining_this_week}
              limit={status.tryon_weekly_limit}
              period="this week"
            />
            <p className="text-xs text-navy/40">
              Buy Next resets daily; chat and TryOn reset over a rolling week.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
