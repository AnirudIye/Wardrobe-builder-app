// First-run style survey: shown once right after account creation (whenever
// the profile has no style_preferences yet). Answers land in the same
// style_preferences JSON the outfit and Buy Next prompts already consume, so
// recommendations fit from the very first run. Skipping records that too, so
// the survey never nags twice.
import { useState } from "react";
import { api, User } from "../api";
import { profileCache } from "../store";
import ErrorNote from "./ErrorNote";

// Retail-neutral phrasing for clothing gender preference: stores split by
// section, so the question asks where the user shops, not who they are.
const SECTIONS = ["menswear", "womenswear", "a bit of both"];
const STYLES = ["minimal", "classic", "streetwear", "sporty", "edgy", "romantic", "business-casual"];
const COLORS = ["neutrals", "earth tones", "pastels", "brights", "mostly black", "jewel tones"];
const BUDGETS = ["under $25", "$25-50", "$50-100", "$100-200", "$200+"];
const OCCASIONS = ["classes", "office", "gym", "nights out", "outdoors", "working from home"];

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full transition duration-150 ease-out-strong ${
        active
          ? "bg-navy text-cream shadow-clay-navy"
          : "bg-cream text-navy/60 hover:text-navy hover:bg-cream-deep/60"
      }`}
    >
      {label}
    </button>
  );
}

export default function StyleSurvey({ onDone }: { onDone: (profile: User) => void }) {
  const [section, setSection] = useState<string | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [budget, setBudget] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [avoid, setAvoid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleIn = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const save = async (skip: boolean) => {
    setBusy(true);
    setError(null);
    const prefs = skip
      ? { skipped: true }
      : {
          shop_section: section,
          styles,
          colors,
          budget,
          occasions,
          ...(avoid.trim() ? { avoid: avoid.trim() } : {}),
        };
    try {
      const updated = await api.updateProfile({ style_preferences: prefs });
      profileCache.set(updated);
      onDone(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-navy/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="clay-card blob-card-a w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <h2 className="font-brand text-3xl tracking-tight">Make it yours</h2>
        <p className="text-sm text-navy/50 mt-1.5">
          Thirty seconds of taste, so outfit and shopping recommendations fit from day one.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-medium text-navy/50 mb-2">Which section do you usually shop?</p>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={section === s}
                  onClick={() => setSection(section === s ? null : s)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-navy/50 mb-2">Which styles feel like you?</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={styles.includes(s)}
                  onClick={() => toggleIn(styles, setStyles, s)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-navy/50 mb-2">Colours you reach for</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={colors.includes(c)}
                  onClick={() => toggleIn(colors, setColors, c)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-navy/50 mb-2">Typical budget per piece</p>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <Chip
                  key={b}
                  label={b}
                  active={budget === b}
                  onClick={() => setBudget(budget === b ? null : b)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-navy/50 mb-2">What does your week look like?</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o}
                  label={o}
                  active={occasions.includes(o)}
                  onClick={() => toggleIn(occasions, setOccasions, o)}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-navy/50">Anything to avoid? (optional)</span>
            <input
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="e.g. no leather, nothing sleeveless"
              className="clay-input w-full mt-1.5"
            />
          </label>
        </div>

        <ErrorNote message={error} className="mt-4" />

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            onClick={() => save(true)}
            disabled={busy}
            className="text-sm text-navy/40 hover:text-navy transition-colors"
          >
            Skip for now
          </button>
          <button onClick={() => save(false)} disabled={busy} className="clay-btn px-6 py-2.5">
            {busy ? "…" : "Save my style"}
          </button>
        </div>
      </div>
    </div>
  );
}
