import { useState } from "react";
import { api, User } from "../api";
import { profileCache } from "../store";
import ErrorNote from "./ErrorNote";

interface Props {
  profile: User | null;
  onProfileChange: (u: User) => void;
}

// The freshest profile wins: the prop comes from AccountMenu, which loads
// once at header mount - a survey save after that only reaches the cache.
function livePrefs(profile: User | null): Record<string, unknown> {
  return (profileCache.peek()?.style_preferences ?? profile?.style_preferences ?? {}) as Record<
    string,
    unknown
  >;
}

export default function Customization({ profile, onProfileChange }: Props) {
  const prefs = livePrefs(profile) as { styles?: string[]; avoid?: string[] };
  const [styles, setStyles] = useState((prefs.styles ?? []).join(", "));
  const [avoid, setAvoid] = useState((prefs.avoid ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const updated = await api.updateProfile({
        // Spread first: this panel edits two fields, but the survey stores
        // more (shop_section, budget, colors, occasions) that must survive.
        style_preferences: {
          ...livePrefs(profile),
          styles: toList(styles),
          avoid: toList(avoid),
        },
      });
      onProfileChange(updated);
      setMsg("Style preferences saved.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-navy/50">These guide your AI outfit and buy-next suggestions.</p>
      <div>
        <p className="text-navy/50 mb-1">Styles you like</p>
        <input
          value={styles}
          onChange={(e) => setStyles(e.target.value)}
          placeholder="minimal, streetwear, classic"
          className="w-full clay-input"
        />
      </div>
      <div>
        <p className="text-navy/50 mb-1">Things to avoid</p>
        <input
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="neon, big logos"
          className="w-full clay-input"
        />
      </div>
      <button onClick={save} disabled={busy} className="clay-btn px-4 py-2">
        Save
      </button>
      {msg && <p className="text-green-600">{msg}</p>}
      <ErrorNote message={err} />
    </div>
  );
}
