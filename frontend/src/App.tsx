import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Wardrobe from "./pages/Wardrobe";
import Today from "./pages/Today";
import BuyNext from "./pages/BuyNext";
import Calendar from "./pages/Calendar";
import Upgrade from "./pages/Upgrade";
import ClickSpark from "./components/ClickSpark";
import BlobCursor from "./components/BlobCursor";
import LegalFooter from "./components/LegalFooter";

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

  // Brand entrance: rises in once on load.
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
    return <div className="min-h-screen flex items-center justify-center text-navy/40">Loading…</div>;
  }

  return (
    <ClickSpark>
      <BlobCursor />
      {!user ? (
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <Login />
          </div>
          <LegalFooter />
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          <header className="pt-5">
            <div className="max-w-4xl mx-auto px-4">
              <div className="clay-card px-6 py-4 flex items-center justify-between">
                <span ref={brandRef} className="font-brand text-3xl tracking-wide">
                  Better<span className="text-blush-deep">Dresser</span>
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-navy/50 hidden sm:inline">{user.email}</span>
                  <button
                    onClick={logout}
                    className="clay-btn-blush px-4 py-1.5 text-sm"
                  >
                    Sign out
                  </button>
                </div>
              </div>
              <nav className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-5 py-2 text-sm rounded-2xl whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 ${
                      tab === t.id
                        ? "bg-navy text-cream font-medium shadow-clay-navy"
                        : "bg-cream-soft text-navy/70 shadow-clay-sm hover:text-navy hover:shadow-clay"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          <main ref={mainRef} className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
            {tab === "wardrobe" && <Wardrobe />}
            {tab === "today" && <Today />}
            {tab === "buy-next" && <BuyNext onQuotaBlocked={() => setTab("upgrade")} />}
            {tab === "calendar" && <Calendar />}
            {tab === "upgrade" && <Upgrade />}
          </main>

          <LegalFooter />
        </div>
      )}
    </ClickSpark>
  );
}
