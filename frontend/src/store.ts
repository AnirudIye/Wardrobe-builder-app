// Concrete cached resources shared across tabs. Mutating pages update these
// optimistically so every other tab sees fresh data without refetching.
import { api, BillingStatus, CalendarEvent, Garment, User, Weather } from "./api";
import { createCachedResource } from "./cache";

export const garmentsCache = createCachedResource<Garment[]>(() => api.listGarments());
export const eventsCache = createCachedResource<CalendarEvent[]>(() => api.listEvents());
export const billingCache = createCachedResource<BillingStatus>(() => api.billingStatus());
export const profileCache = createCachedResource<User>(() => api.profile());
export const weatherCache = createCachedResource<Weather>(() => api.weather());
