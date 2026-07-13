import { useEffect, useState } from "react";
import { api, BillingStatus } from "../api";

export default function Upgrade() {
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

  if (!status) return <p className="text-neutral-500">Loading plan…</p>;

  const isPaid = status.plan === "paid";

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-4">Your plan</h2>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <p className="text-2xl font-semibold capitalize">
            {isPaid ? "Wardrobe Builder Plus" : "Free plan"}
          </p>
          {isPaid ? (
            <p className="text-sm text-neutral-500">Unlimited recommendations.</p>
          ) : (
            <p className="text-sm text-neutral-500">
              {status.remaining_this_week} of {status.weekly_limit} recommendations left this week.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isPaid ? (
          <button
            onClick={openPortal}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
          >
            Manage subscription
          </button>
        ) : (
          <button
            onClick={startCheckout}
            disabled={busy}
            className="w-full rounded-lg bg-neutral-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? "Redirecting…" : "Upgrade to Plus — $5/month"}
          </button>
        )}
      </div>
    </div>
  );
}
