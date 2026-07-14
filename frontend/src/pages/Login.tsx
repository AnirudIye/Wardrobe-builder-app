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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form ref={cardRef} onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow p-8 space-y-5">
        <div className="text-center">
          <h1 className="font-brand text-4xl tracking-wide">BetterDresser</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {mode === "login" ? "Sign in to your wardrobe" : "Create your account"}
          </p>
        </div>

        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-neutral-900 text-white py-2 font-medium disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="text-center text-sm text-neutral-500">
          {mode === "login" ? "No account?" : "Already have one?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-neutral-900 underline"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
