import { useEffect, useState } from "react";
import { api, FitStatus, Garment, WearStats } from "../api";
import { useFadeRise } from "../animations";
import { localISODate } from "../date";
import { Skeleton } from "../components/Skeleton";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ShareActions from "../components/ShareCard";
import { Wardrobe as WardrobeIll } from "../components/illustrations";
import { garmentsCache, streakCache, wearStatsCache } from "../store";

export default function Streak() {
  const [status, setStatus] = useState<FitStatus | null>(streakCache.peek());
  const [garments, setGarments] = useState<Garment[] | null>(garmentsCache.peek());
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [challengeClaim, setChallengeClaim] = useState(false);
  const [wearStats, setWearStats] = useState<WearStats | null>(wearStatsCache.peek());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useFadeRise<HTMLDivElement>();

  useEffect(() => {
    streakCache
      .get()
      .then(setStatus)
      .catch((e) => setError((e as Error).message));
    garmentsCache.get().then(setGarments).catch(() => {});
    wearStatsCache.get().then(setWearStats).catch(() => {});
  }, []);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await api.logFit(selected, "manual", { challenge_done: challengeClaim });
      streakCache.set(fresh);
      setStatus(fresh);
      setPicking(false);
      setSelected([]);
      setChallengeClaim(false);
      // A new log changes wear counts, so cost-per-wear must refetch.
      wearStatsCache.clear();
      wearStatsCache.get().then(setWearStats).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    setSelected(status?.today_garment_ids ?? []);
    setChallengeClaim(status?.challenge_done ?? false);
    setPicking(true);
  };

  const today = localISODate();
  const showPicker = status != null && (!status.today_logged || picking);
  const wornToday =
    status?.today_logged && garments
      ? garments.filter((g) => status.today_garment_ids.includes(g.id))
      : [];

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Streak"
        context="Log what you wear each day. Consecutive days build your streak; one missed day a week is forgiven."
        action={status && status.current_streak > 0 ? <ShareActions status={status} /> : undefined}
      />

      <ErrorNote message={error} className="mb-4" />

      {status && (
        <div className="clay-card blob-card-a px-5 py-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="clay-chip bg-blush-soft">Today's challenge</span>
          <p className="text-sm">
            <span className="font-semibold">{status.challenge_name}.</span>{" "}
            <span className="text-navy/60">{status.challenge_brief}</span>
          </p>
          {status.challenge_done ? (
            <span className="text-xs font-medium text-navy/70 ml-auto">Done, +5 points</span>
          ) : (
            <span className="text-xs text-navy/40 ml-auto">Claim it when you log, +5 points</span>
          )}
        </div>
      )}

      {!status && (
        <div className="clay-card blob-card-b p-8">
          <Skeleton className="h-24 w-40 mb-6" />
          <Skeleton className="h-10 w-72 mb-4" />
          <Skeleton className="h-4 w-56" />
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Streak hero */}
          <div className="lg:col-span-2 clay-card blob-card-b p-8 text-center">
            <p className="font-brand text-8xl leading-none">{status.current_streak}</p>
            <p className="text-sm text-navy/60 mt-2">
              {status.current_streak === 1 ? "day streak" : "day streak"}
              {status.today_logged ? "" : " · log today to keep it going"}
            </p>

            {/* This ISO week, Monday through Sunday */}
            <div className="flex justify-center gap-2 mt-6">
              {status.week.map((day) => {
                const letter = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "narrow",
                });
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-xl ${
                        day.logged ? "bg-navy shadow-clay-navy" : "bg-cream-deep"
                      } ${day.date === today ? "ring-2 ring-blush-deep ring-offset-2 ring-offset-cream" : ""}`}
                      title={day.date}
                    />
                    <span className="text-[10px] text-navy/40">{letter}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-8 text-center">
              <div>
                <p className="font-brand text-3xl leading-none">{status.longest_streak}</p>
                <p className="text-xs text-navy/50 mt-1">longest</p>
              </div>
              <div>
                <p className="font-brand text-3xl leading-none">{status.week_points}</p>
                <p className="text-xs text-navy/50 mt-1">points this week</p>
              </div>
              <div>
                <p className="font-brand text-3xl leading-none">{status.closet_score}</p>
                <p className="text-xs text-navy/50 mt-1">closet score</p>
              </div>
            </div>

            {status.percentile != null && (
              <p className="text-sm text-navy/60 mt-6">
                More days logged than{" "}
                <span className="font-semibold text-navy">{status.percentile}%</span> of everyone
                logging this week.
              </p>
            )}
          </div>

          {/* Logging panel */}
          <div className="lg:col-span-3">
            {garments && garments.length === 0 && (
              <EmptyState
                Ill={WardrobeIll}
                title="Your closet is empty"
                body="Add a few pieces in My Wardrobe first. Once your clothes are in, logging what you wore takes two taps a day."
              />
            )}

            {garments && garments.length > 0 && status.today_logged && !picking && (
              <div className="clay-card blob-card-a p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-brand text-2xl">Logged for today</h3>
                  <button onClick={startEditing} className="clay-chip hover:bg-blush">
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {wornToday.map((g) => (
                    <div key={g.id} className="clay-card overflow-hidden">
                      <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                      <p className="text-xs px-3 py-2 text-navy/70 font-medium capitalize">
                        {g.subcategory ?? g.category ?? "item"}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-navy/40 mt-4">
                  {status.today_source === "recommendation"
                    ? "Straight from Today's Recommendations."
                    : "Picked by hand."}
                </p>
              </div>
            )}

            {garments && garments.length > 0 && showPicker && (
              <div className="clay-card blob-card-a p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-brand text-2xl">What did you wear today?</h3>
                  {picking && (
                    <button
                      onClick={() => {
                        setPicking(false);
                        setSelected([]);
                        setChallengeClaim(false);
                      }}
                      className="text-xs text-navy/40 hover:text-navy"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-sm text-navy/50 mb-4">
                  Tap the pieces you wore. Wearing the recommendation? One tap on the Today tab
                  logs it for you.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {garments.map((g) => {
                    const on = selected.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggle(g.id)}
                        className={`clay-card overflow-hidden text-left transition duration-200 ease-out-strong ${
                          on ? "ring-2 ring-blush-deep" : "hover:-translate-y-0.5"
                        }`}
                        aria-pressed={on}
                      >
                        <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2.5 mt-5 text-sm text-navy/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={challengeClaim}
                    onChange={(e) => setChallengeClaim(e.target.checked)}
                    className="w-4 h-4 accent-blush-deep"
                  />
                  <span>
                    I did today's challenge
                    <span className="text-navy/40"> · {status.challenge_name} (+5 points)</span>
                  </span>
                </label>
                <button
                  onClick={submit}
                  disabled={busy || selected.length === 0}
                  className="clay-btn px-6 py-2.5 mt-4 disabled:opacity-40"
                >
                  {busy
                    ? "Logging…"
                    : selected.length === 0
                      ? "Pick at least one piece"
                      : `Log ${selected.length} ${selected.length === 1 ? "piece" : "pieces"}`}
                </button>
              </div>
            )}

            {/* Cost per wear: the wear log paying off */}
            {garments && garments.length > 0 && wearStats && (
              <div className="clay-card p-6 mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-brand text-2xl">Cost per wear</h3>
                  {wearStats.closet_value > 0 && (
                    <span className="text-xs text-navy/40">
                      ${wearStats.closet_value.toFixed(0)} closet value
                    </span>
                  )}
                </div>
                {(() => {
                  const best = wearStats.items
                    .filter((w) => w.cost_per_wear != null)
                    .sort((a, b) => (a.cost_per_wear ?? 0) - (b.cost_per_wear ?? 0))
                    .slice(0, 3);
                  if (best.length === 0) {
                    return (
                      <p className="text-sm text-navy/50 mt-2">
                        Add prices to your pieces in My Wardrobe. Every wear you log here lowers
                        their cost per wear.
                      </p>
                    );
                  }
                  return (
                    <div className="mt-4 space-y-3">
                      {best.map((w) => {
                        const g = garments.find((x) => x.id === w.garment_id);
                        if (!g) return null;
                        return (
                          <div key={w.garment_id} className="flex items-center gap-3">
                            <img
                              src={g.thumbnail_url}
                              alt=""
                              className="w-12 h-12 rounded-xl object-cover shadow-clay-sm shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize line-clamp-1">
                                {g.subcategory ?? g.category ?? "item"}
                              </p>
                              <p className="text-xs text-navy/50">
                                ${w.cost_per_wear?.toFixed(2)}/wear · worn {w.wears}{" "}
                                {w.wears === 1 ? "time" : "times"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {wearStats.never_worn > 0 && (
                  <p className="text-xs text-navy/40 mt-4">
                    {wearStats.never_worn}{" "}
                    {wearStats.never_worn === 1 ? "piece hasn't" : "pieces haven't"} been worn
                    yet. Working them in is free value.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
