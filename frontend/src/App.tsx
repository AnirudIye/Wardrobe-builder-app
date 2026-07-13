import { useState } from "react";
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400">Loading…</div>;
  }
  if (!user) return <Login />;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold">Wardrobe Builder</span>
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
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                tab === t.id
                  ? "border-neutral-900 font-medium"
                  : "border-transparent text-neutral-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "wardrobe" && <Wardrobe />}
        {tab === "today" && <Today onQuotaBlocked={() => setTab("upgrade")} />}
        {tab === "buy-next" && <BuyNext onQuotaBlocked={() => setTab("upgrade")} />}
        {tab === "calendar" && <Calendar />}
        {tab === "upgrade" && <Upgrade />}
      </main>
    </div>
  );
}
