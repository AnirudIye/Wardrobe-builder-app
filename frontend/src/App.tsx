import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Wardrobe from "./pages/Wardrobe";
import Today from "./pages/Today";
import BuyNext from "./pages/BuyNext";
import Calendar from "./pages/Calendar";
import Upgrade from "./pages/Upgrade";

type Tab = "wardrobe" | "today" | "buy-next" | "calendar" | "upgrade";

const TABS: { id: Tab; label: string }[] = [
  { id: "wardrobe", label: "Wardrobe" },
  { id: "today", label: "Today" },
  { id: "buy-next", label: "Buy Next" },
  { id: "calendar", label: "Calendar" },
  { id: "upgrade", label: "Plan" },
];

export default function App() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("wardrobe");
  const brandRef = useRef<HTMLSpanElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Brand entrance: letters slide up once on load.
  useEffect(() => {
    if (user && brandRef.current) {
      animate(brandRef.current, {
        opacity: [0, 1],
        translateY: [-8, 0],
        duration: 600,
        ease: "outQuad",
      });
    }
  }, [user]);

  // Cross-fade the main area whenever the tab changes.
  useEffect(() => {
    if (mainRef.current) {
      animate(mainRef.current, { opacity: [0, 1], duration: 300, ease: "outQuad" });
    }
  }, [tab]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400">Loading…</div>;
  }
  if (!user) return <Login />;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span ref={brandRef} className="font-brand text-2xl tracking-wide">
            BetterDresser
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-500 hidden sm:inline">{user.email}</span>
            <button onClick={logout} className="text-neutral-600 underline">
              Sign out
            </button>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-neutral-900 font-medium"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main ref={mainRef} className="max-w-4xl mx-auto px-4 py-6">
        {tab === "wardrobe" && <Wardrobe />}
        {tab === "today" && <Today onQuotaBlocked={() => setTab("upgrade")} />}
        {tab === "buy-next" && <BuyNext onQuotaBlocked={() => setTab("upgrade")} />}
        {tab === "calendar" && <Calendar />}
        {tab === "upgrade" && <Upgrade />}
      </main>
    </div>
  );
}
