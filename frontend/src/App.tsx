import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Wardrobe from "./pages/Wardrobe";
import Today from "./pages/Today";
import BuyNext from "./pages/BuyNext";
import Calendar from "./pages/Calendar";
import DresserAI from "./pages/DresserAI";
import TryOn from "./pages/TryOn";
import Upgrade from "./pages/Upgrade";
import ClickSpark from "./components/ClickSpark";
import BlobCursor from "./components/BlobCursor";
import LegalFooter from "./components/LegalFooter";
import AccountMenu from "./components/AccountMenu";

type Tab = "wardrobe" | "today" | "buy-next" | "calendar" | "dresser-ai" | "tryon" | "upgrade";

const TABS: { id: Tab; label: string }[] = [
  { id: "wardrobe", label: "My Wardrobe" },
  { id: "today", label: "Today's Recommendations" },
  { id: "buy-next", label: "What To Buy Next" },
  { id: "calendar", label: "Calendar" },
  { id: "dresser-ai", label: "DresserAI" },
  { id: "tryon", label: "TryOn" },
  { id: "upgrade", label: "Plan" },
];

export default function App() {
  const { user, loading, verifyEmail } = useAuth();
  const [tab, setTab] = useState<Tab>("wardrobe");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  // Logged-out visitors see the marketing landing first; verify-link visitors
  // jump straight to the auth view.
  const [authView, setAuthView] = useState<"landing" | "login">(() =>
    new URLSearchParams(window.location.search).has("verify_token") ? "login" : "landing"
  );
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

  // Email verification landing: the confirmation email links to
  // `/?verify_token=...`. Verify once on load, then strip the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify_token");
    if (!token) return;
    verifyEmail(token)
      .then(() => setVerifyMsg("Email confirmed, you're all set!"))
      .catch(() => setVerifyMsg("That confirmation link is invalid or has expired."))
      .finally(() => {
        params.delete("verify_token");
        const q = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-navy/40">Loading…</div>;
  }

  return (
    <ClickSpark>
      <BlobCursor />
      {verifyMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9995] clay-card px-5 py-2 text-sm">
          {verifyMsg}
          <button onClick={() => setVerifyMsg(null)} className="ml-3 text-navy/40 hover:text-navy">×</button>
        </div>
      )}
      {!user ? (
        authView === "landing" ? (
          <Landing onGetStarted={() => setAuthView("login")} />
        ) : (
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">
              <Login onBack={() => setAuthView("landing")} />
            </div>
            <LegalFooter />
          </div>
        )
      ) : (
        <div className="min-h-screen flex flex-col">
          <header className="pt-5">
            <div className="max-w-4xl mx-auto px-4">
              <div className="clay-card px-6 py-4 flex items-center justify-between">
                <span ref={brandRef} className="font-brand text-3xl tracking-wide">
                  Better<span className="text-blush-deep">Dresser</span>
                </span>
                <AccountMenu onUpgrade={() => setTab("upgrade")} />
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
            {tab === "dresser-ai" && <DresserAI onQuotaBlocked={() => setTab("upgrade")} />}
            {tab === "tryon" && <TryOn onQuotaBlocked={() => setTab("upgrade")} />}
            {tab === "upgrade" && <Upgrade />}
          </main>

          <LegalFooter />
        </div>
      )}
    </ClickSpark>
  );
}
