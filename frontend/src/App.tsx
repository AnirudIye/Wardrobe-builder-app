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
import { CardGridSkeleton, Skeleton } from "./components/Skeleton";
import StyleSurvey from "./components/StyleSurvey";
import { profileCache } from "./store";
import { prefetchTab } from "./prefetch";
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
  // Logged-out visitors see the marketing landing first; verify-link and
  // reset-link visitors jump straight to the auth view. "register" opens the
  // same auth screen on the sign-up form (landing CTAs lead there).
  const [authView, setAuthView] = useState<"landing" | "login" | "register">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("verify_token") || params.has("reset_token") ? "login" : "landing";
  });
  // Password reset landing: the reset email links to `/?reset_token=...`.
  // Capture it once (Login renders its set-a-new-password view), then strip it.
  const [resetToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("reset_token")
  );
  const brandRef = useRef<HTMLSpanElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // First-run style survey: shows once while the profile has no
  // style_preferences yet (fresh account), and never again after save/skip.
  const [showSurvey, setShowSurvey] = useState(false);
  useEffect(() => {
    if (!user) {
      setShowSurvey(false);
      return;
    }
    let stale = false;
    profileCache
      .get()
      .then((p) => {
        if (!stale) setShowSurvey(p.style_preferences == null);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [user]);

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

  // Cross-fade the main area whenever the tab changes. Tab switching is a
  // high-frequency action, so keep it brisk (emil-design-eng skill).
  useEffect(() => {
    if (mainRef.current) {
      animate(mainRef.current, { opacity: [0, 1], duration: 200, ease: "outQuad" });
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

  // Strip the reset token from the URL once captured (it's held in state).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("reset_token")) return;
    params.delete("reset_token");
    const q = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
  }, []);

  if (loading) {
    // Session check in flight: sketch the app shell with skeletons. Tokenless
    // visitors resolve instantly, so only signed-in users ever see this.
    return (
      <div className="min-h-screen max-w-5xl mx-auto px-4 pt-4">
        <div className="clay-card px-5 sm:px-6 py-3.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <div className="flex gap-1.5 mt-3">
            {["w-24", "w-40", "w-32", "w-20", "w-24"].map((w, i) => (
              <Skeleton key={i} className={`h-8 ${w} rounded-full`} />
            ))}
          </div>
        </div>
        <div className="mt-10 space-y-5">
          <Skeleton className="h-9 w-56" />
          <CardGridSkeleton count={6} cols="grid-cols-2 sm:grid-cols-3" />
        </div>
      </div>
    );
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
          <Landing
            onGetStarted={() => setAuthView("register")}
            onSignIn={() => setAuthView("login")}
          />
        ) : (
          <div className="min-h-screen flex flex-col overflow-x-clip">
            <div className="flex-1">
              <Login
                onBack={() => setAuthView("landing")}
                resetToken={resetToken}
                initialMode={authView === "register" ? "register" : "login"}
              />
            </div>
            <LegalFooter />
          </div>
        )
      ) : (
        // overflow-x-clip is a mobile safety net against stray wide content; it
        // does NOT create a scroll container, so the sticky header still works.
        <div className="min-h-screen flex flex-col overflow-x-clip">
          {showSurvey && <StyleSurvey onDone={() => setShowSurvey(false)} />}
          <header className="sticky top-0 z-40 pt-4 pb-2 bg-cream/85 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-4">
              <div className="clay-card px-5 sm:px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <span ref={brandRef} className="font-brand text-2xl sm:text-3xl tracking-wide leading-none">
                    Better<span className="text-blush-deep">Dresser</span>
                  </span>
                  <AccountMenu onUpgrade={() => setTab("upgrade")} />
                </div>
                <nav aria-label="Primary" className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      // Intent to navigate → warm that tab's images before the click.
                      // pointerEnter covers mouse hover; focus covers keyboard.
                      onPointerEnter={() => prefetchTab(t.id)}
                      onFocus={() => prefetchTab(t.id)}
                      className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition duration-200 ease-out-strong hover:-translate-y-0.5 ${
                        tab === t.id
                          ? "bg-navy text-cream font-medium shadow-clay-navy"
                          : "text-navy/60 hover:text-navy hover:bg-cream"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </header>

          <main ref={mainRef} className="max-w-5xl mx-auto px-4 py-10 w-full flex-1">
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
