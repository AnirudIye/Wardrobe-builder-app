import { useState } from "react";
import { useAuth } from "../auth";
import { useFadeRise } from "../animations";
import { api, ApiError } from "../api";
import ErrorNote from "../components/ErrorNote";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { Coat, Sneaker, SunCloud, Tee } from "../components/illustrations";

type Mode = "login" | "register" | "forgot" | "reset";

export default function Login({
  onBack,
  resetToken,
  initialMode = "login",
}: {
  onBack?: () => void;
  resetToken?: string | null;
  initialMode?: "login" | "register";
}) {
  const cardRef = useFadeRise<HTMLDivElement>();
  const { login, register, resetPassword } = useAuth();
  // Arriving via an emailed `/?reset_token=...` link opens straight on the
  // set-a-new-password view; landing CTAs open register or sign-in directly.
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [agreedTos, setAgreedTos] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        const created = await register(email, password);
        if (!created.email_verified) {
          setNeedsConfirm(true);
        }
      } else if (mode === "forgot") {
        await api.forgotPassword(email);
        setForgotSent(true);
      } else {
        // On success the auth context refreshes and the app renders signed in.
        await resetPassword(resetToken ?? "", password);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && mode === "login") {
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

  if (forgotSent) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm clay-card blob-card-b p-8 space-y-4 text-center">
          <h1 className="font-brand text-4xl tracking-tight">Check your email</h1>
          <p className="text-sm text-navy/60">
            If an account exists for <span className="font-medium">{email}</span>, a password
            reset link is on its way. The link works for one hour.
          </p>
          <button
            onClick={() => {
              setForgotSent(false);
              switchMode("login");
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
        className="w-full max-w-3xl clay-card blob-card-a overflow-hidden grid grid-cols-1 md:grid-cols-2"
      >
        {/* Form panel */}
        <form onSubmit={submit} className="p-8 sm:p-10 space-y-5">
          <div>
            <h1 className="font-brand text-4xl tracking-tight">
              Better<span className="text-blush-deep">Dresser</span>
            </h1>
            <p className="text-sm text-navy/50 mt-1.5">
              {mode === "login" && "Sign in to your wardrobe"}
              {mode === "register" && "Create your account"}
              {mode === "forgot" && "We'll email you a reset link"}
              {mode === "reset" && "Choose a new password"}
            </p>
          </div>

          {mode !== "reset" && (
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
          )}
          {mode !== "forgot" && (
            <label className="block">
              <span className="text-xs font-medium text-navy/50">
                {mode === "reset" ? "New password" : "Password"}
              </span>
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
          )}
          {mode === "login" && (
            <p className="text-right -mt-2">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs text-navy/50 hover:text-navy underline decoration-blush decoration-2 underline-offset-4 transition-colors"
              >
                Forgot password?
              </button>
            </p>
          )}

          {mode === "register" && (
            <label className="flex items-start gap-2.5 text-xs text-navy/60 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={agreedTos}
                onChange={(e) => setAgreedTos(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blush-deep shrink-0"
              />
              <span>
                I have read and agree to the terms of service and privacy policy.
              </span>
            </label>
          )}

          <ErrorNote message={error} />
          {mode === "reset" && error && (
            <p className="text-center text-sm text-navy/50">
              Reset links work once and expire after an hour.{" "}
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                Request a new one
              </button>
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "register" && !agreedTos)}
            className="w-full clay-btn py-2.5"
          >
            {busy
              ? "…"
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Email me a reset link"
                    : "Set new password"}
          </button>

          {(mode === "login" || mode === "register") && (
            <GoogleSignInButton onError={setError} />
          )}

          {mode === "login" || mode === "register" ? (
            <p className="text-center text-sm text-navy/50">
              {mode === "login" ? "No account?" : "Already have one?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                {mode === "login" ? "Register" : "Sign in"}
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-navy/50">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-navy underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                Back to sign in
              </button>
            </p>
          )}

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
