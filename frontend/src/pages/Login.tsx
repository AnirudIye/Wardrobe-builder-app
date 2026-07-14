import { useState } from "react";
import { useAuth } from "../auth";
import { useFadeRise } from "../animations";

export default function Login() {
  const cardRef = useFadeRise<HTMLFormElement>();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

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
      </form>
    </div>
  );
}
