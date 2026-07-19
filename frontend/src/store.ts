// Concrete cached resources shared across tabs. Mutating pages update these
// optimistically so every other tab sees fresh data without refetching.
import { api, BillingStatus, CalendarEvent, FitStatus, Garment, User, Weather, WearStats } from "./api";
import { createCachedResource } from "./cache";

export const garmentsCache = createCachedResource<Garment[]>(() => api.listGarments());
export const eventsCache = createCachedResource<CalendarEvent[]>(() => api.listEvents());
export const billingCache = createCachedResource<BillingStatus>(() => api.billingStatus());
export const profileCache = createCachedResource<User>(() => api.profile());
export const weatherCache = createCachedResource<Weather>(() => api.weather());
export const streakCache = createCachedResource<FitStatus>(() => api.fitStatus());
// Cleared whenever a log or a garment price changes - both move cost-per-wear.
export const wearStatsCache = createCachedResource<WearStats>(() => api.wearStats());
