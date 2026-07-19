// Concrete cached resources shared across tabs. Mutating pages update these
// optimistically so every other tab sees fresh data without refetching.
import { api, BillingStatus, CalendarEvent, FitStatus, Garment, User, Weather, WearStats } from "./api";
import { CachedResource, createCachedResource } from "./cache";
import { localISODate } from "./date";

export const garmentsCache = createCachedResource<Garment[]>(() => api.listGarments());
export const eventsCache = createCachedResource<CalendarEvent[]>(() => api.listEvents());
export const billingCache = createCachedResource<BillingStatus>(() => api.billingStatus());
export const profileCache = createCachedResource<User>(() => api.profile());
export const weatherCache = createCachedResource<Weather>(() => api.weather());
// Streak status is only valid for the local calendar day it was fetched on:
// the streak count, week grid, and daily challenge all key on "today". A tab
// left open across midnight must refetch, or yesterday's challenge (and an
// unlogged-today state) would keep showing.
const streakInner = createCachedResource<FitStatus>(() => api.fitStatus());
let streakFetchedFor: string | null = null;

export const streakCache: CachedResource<FitStatus> = {
  get(force = false) {
    const stale = streakFetchedFor !== localISODate();
    streakFetchedFor = localISODate();
    return streakInner.get(force || stale);
  },
  peek: () => (streakFetchedFor === localISODate() ? streakInner.peek() : null),
  set(value) {
    // Callers only ever set fresh server responses (log/status round trips).
    streakFetchedFor = localISODate();
    streakInner.set(value);
  },
  update(fn) {
    streakInner.update(fn);
  },
  clear() {
    streakFetchedFor = null;
    streakInner.clear();
  },
};

// Cleared whenever a log or a garment price changes - both move cost-per-wear.
export const wearStatsCache = createCachedResource<WearStats>(() => api.wearStats());
