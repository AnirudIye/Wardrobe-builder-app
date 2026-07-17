import { useState } from "react";
import { useAuth } from "../auth";
import { useFadeRise } from "../animations";
import { api, ApiError } from "../api";
import ErrorNote from "../components/ErrorNote";
import { Coat, Sneaker, SunCloud, Tee } from "../components/illustrations";

export default function Login({ onBack }: { onBack?: () => void }) {
  const cardRef = useFadeRise<HTMLDivElement>();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const created = await register(email, password);
        if (!created.email_verified) {
          setNeedsConfirm(true);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNeedsConfirm(true); // unverified email on login
      } else {
        setError((err as Error).message ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResendMsg(null);
    try {
      await api.resendVerification(email);
      setResendMsg("Confirmation email sent. Check your inbox.");
    } catch {
      setResendMsg("Couldn't resend right now. Try again shortly.");
    }
  };

  if (needsConfirm) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm clay-card blob-card-b p-8 space-y-4 text-center">
          <h1 className="font-brand text-4xl tracking-tight">Check your email</h1>
          <p className="text-sm text-navy/60">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <button onClick={resend} className="clay-btn px-5 py-2.5 w-full">
            Resend email
          </button>
          {resendMsg && <p className="text-sm text-navy/50">{resendMsg}</p>}
          <button
            onClick={() => {
              setNeedsConfirm(false);
              setMode("login");
            }}
            className="text-sm text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep"
          >
            Back to sign in
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="block w-full text-xs text-navy/40 hover:text-navy transition-colors"
            >
              ← Back to home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div
        ref={cardRef}
        className="w-full max-w-3xl clay-card blob-card-a overflow-hidden grid md:grid-cols-2"
      >
        {/* Form panel */}
        <form onSubmit={submit} className="p-8 sm:p-10 space-y-5">
          <div>
            <h1 className="font-brand text-4xl tracking-tight">
              Better<span className="text-blush-deep">Dresser</span>
            </h1>
            <p className="text-sm text-navy/50 mt-1.5">
              {mode === "login" ? "Sign in to your wardrobe" : "Create your account"}
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-navy/50">Email</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full clay-input mt-1.5"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/50">Password</span>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full clay-input mt-1.5"
            />
          </label>

          <ErrorNote message={error} />

          <button type="submit" disabled={busy} className="w-full clay-btn py-2.5">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="text-center text-sm text-navy/50">
            {mode === "login" ? "No account?" : "Already have one?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full text-center text-xs text-navy/40 hover:text-navy transition-colors"
            >
              ← Back to home
            </button>
          )}
        </form>

        {/* Brand panel (hidden on mobile) */}
        <div className="hidden md:flex relative bg-navy text-cream flex-col justify-end p-8 overflow-hidden">
          <div className="absolute -top-6 right-6 w-24 h-24 blob-b bg-cream/10 grid place-items-center p-4 animate-floaty">
            <Coat className="w-full h-full" />
          </div>
          <div className="absolute top-24 left-8 w-20 h-20 blob-d bg-cream/10 grid place-items-center p-3.5 animate-floaty-slow">
            <Tee className="w-full h-full" />
          </div>
          <div className="absolute top-1/2 right-10 w-20 h-20 blob-a bg-cream/10 grid place-items-center p-3.5 animate-floaty">
            <Sneaker className="w-full h-full" />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-xs text-cream/60">
              <SunCloud className="w-4 h-4" /> weather-aware, calendar-aware
            </span>
            <p className="font-brand text-3xl leading-snug mt-2 tracking-tight">
              Your closet already has great outfits in it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
