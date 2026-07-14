import { useEffect, useState } from "react";
import { api, BillingStatus } from "../api";
import { useFadeRise } from "../animations";

export default function Upgrade() {
  const pageRef = useFadeRise<HTMLDivElement>();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setStatus(await api.billingStatus());
  useEffect(() => {
    load();
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

  if (!status) return <p className="text-navy/50">Loading plan…</p>;

  const isPaid = status.plan === "paid";

  return (
    <div ref={pageRef} className="max-w-md">
      <h2 className="text-xl font-semibold mb-4">Your plan</h2>
      <div className="clay-card clay-card-hover p-7 space-y-5">
        <div>
          <p className="font-brand text-3xl">
            {isPaid ? "BetterDresser Plus" : "Free plan"}
          </p>
          {isPaid ? (
            <p className="text-sm text-navy/50 mt-1">
              Unlimited buy-next suggestions, DresserAI messages, and try-ons.
            </p>
          ) : (
            <div className="text-sm text-navy/50 mt-2 space-y-2">
              <p>
                <span className="clay-chip mr-1">
                  {status.remaining_this_week} of {status.weekly_limit}
                </span>
                buy-next suggestions left this week.
              </p>
              <p>
                <span className="clay-chip mr-1">
                  {status.chat_remaining_this_week} of {status.chat_weekly_limit}
                </span>
                DresserAI messages left this week.
              </p>
              <p>
                <span className="clay-chip mr-1">
                  {status.tryon_remaining_this_week} of {status.tryon_weekly_limit}
                </span>
                try-ons left this week.
              </p>
              <p>Outfit recommendations are always free.</p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {isPaid ? (
          <button onClick={openPortal} disabled={busy} className="clay-btn-blush px-5 py-2 text-sm">
            Manage subscription
          </button>
        ) : (
          <button onClick={startCheckout} disabled={busy} className="w-full clay-btn py-3">
            {busy ? "Redirecting…" : "Upgrade to Plus — $5/month"}
          </button>
        )}
      </div>
    </div>
  );
}
