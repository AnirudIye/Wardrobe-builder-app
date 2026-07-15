import { useState } from "react";
import { useAuth } from "../auth";
import { useFadeRise } from "../animations";
import { api, ApiError } from "../api";

export default function Login({ onBack }: { onBack?: () => void }) {
  const cardRef = useFadeRise<HTMLFormElement>();
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
        <div className="w-full max-w-sm clay-card p-8 space-y-4 text-center">
          <h1 className="font-brand text-4xl tracking-wide">Check your email</h1>
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
    <div className="min-h-[70vh] flex items-center justify-center px-4 pt-16">
      <form
        ref={cardRef}
        onSubmit={submit}
        className="w-full max-w-sm clay-card clay-card-hover p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="font-brand text-5xl tracking-wide">
            Better<span className="text-blush-deep">Dresser</span>
          </h1>
          <p className="text-sm text-navy/50 mt-1">
            {mode === "login" ? "Sign in to your wardrobe" : "Create your account"}
          </p>
        </div>

        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full clay-input"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full clay-input"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

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
    </div>
  );
}
