// Thin typed client for the BetterDresser API.
// All requests go through /api, which Vite proxies to the FastAPI backend.
import { localISODate } from "./date";

const TOKEN_KEY = "wb_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Every message thrown from this file ends up verbatim in an ErrorNote, so it
// must always read as a plain sentence - never a JSON.parse SyntaxError, a
// "Failed to fetch", a stringified validation array, or an empty statusText.

// fetch itself only rejects on network-level failure (offline, DNS, refused
// connection) - status 0 keeps callers' ApiError handling uniform.
async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
}

// The backend always answers JSON, but the infrastructure in front of it (dev
// proxy with the backend down, host error pages) answers HTML or plain text.
async function parseBody(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function statusMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That wasn't found. It may have been removed.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 502 || status === 503 || status === 504)
    return "The server isn't responding right now. Please try again in a moment.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "Something went wrong. Please try again.";
}

function errorMessage(body: Record<string, unknown> | null, status: number, fallback?: string): string {
  const detail = body?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation errors: [{loc, msg, type}, ...] - surface the first
    // human sentence, tagged with the offending field.
    const first = detail[0] as { loc?: unknown[]; msg?: unknown };
    if (typeof first?.msg === "string") {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
      return typeof field === "string" && field !== "body" ? `${first.msg} (${field})` : first.msg;
    }
  }
  // Server-side failures get the status message even when the caller supplied
  // a contextual fallback - "the server isn't responding" beats "try again".
  if (status >= 500) return statusMessage(status);
  return fallback ?? statusMessage(status);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await safeFetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const body = await parseBody(res);
  if (!res.ok) {
    // A 401 here is always a dead/expired token (login and verifyEmail use
    // their own raw fetch, so wrong-password 401s never reach this path).
    // Drop it and tell the app so the user lands back on the login screen.
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("wb:unauthorized"));
    }
    throw new ApiError(res.status, errorMessage(body, res.status));
  }
  return body as T;
}

// --- Types ---
export interface User {
  id: number;
  email: string;
  email_verified?: boolean;
  plan: string;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  avatar_url?: string | null;
  style_preferences?: Record<string, unknown> | null;
}
export interface Garment {
  id: number;
  image_url: string;
  thumbnail_url: string;
  category?: string | null;
  subcategory?: string | null;
  colors: string[];
  pattern?: string | null;
  material?: string | null;
  formality?: string | null;
  warmth_rating?: number | null;
  seasons: string[];
}
export interface LocationCandidate {
  label: string;
  lat: number;
  lon: number;
}
export interface Weather {
  temp_c: number;
  feels_like_c: number;
  condition: string;
  description: string;
  wind_kph: number;
  humidity: number;
}
export interface OutfitRecommendation {
  items: Garment[];
  rationale: string;
  source: string;
  weather: Weather | null;
}
export interface Product {
  title: string;
  price?: string | null;
  link?: string | null;
  thumbnail?: string | null;
  source?: string | null;
}
export interface BuyNextItem {
  description: string;
  rationale: string;
  products: Product[];
  search_url?: string | null;
}
export interface BuyNext {
  suggestions: BuyNextItem[];
  source: string;
}
export interface CalendarEvent {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  event_type: string;
  notes?: string | null;
}
export interface BillingStatus {
  plan: string;
  subscription_status?: string | null;
  remaining_today: number | null;
  daily_limit: number;
  chat_remaining_this_week: number | null;
  chat_weekly_limit: number;
  tryon_remaining_this_week: number | null;
  tryon_weekly_limit: number;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Endpoints ---
export const api = {
  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  verifyEmail: async (token: string) => {
    const res = await safeFetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(body, res.status, "Verification failed. Please try the link again."));
    }
    setToken(body!.access_token as string);
    return body!.access_token as string;
  },

  resendVerification: (email: string) =>
    request<{ detail: string }>("/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    request<{ detail: string }>("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),

  resetPassword: async (token: string, password: string) => {
    // Raw fetch like verifyEmail: a 400 here is a dead link, not a dead session.
    const res = await safeFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(body, res.status, "Couldn't reset your password. Please try again."));
    }
    setToken(body!.access_token as string);
    return body!.access_token as string;
  },

  login: async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password });
    const res = await safeFetch("/api/auth/login", { method: "POST", body: form });
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(body, res.status, "Couldn't sign you in. Please try again."));
    }
    setToken(body!.access_token as string);
    return body!.access_token as string;
  },

  googleConfig: () => request<{ client_id: string | null }>("/auth/google/config"),

  googleSignIn: async (credential: string) => {
    // Raw fetch like login: a failure here is not a dead session.
    const res = await safeFetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(body, res.status, "Google sign-in failed. Please try again."));
    }
    setToken(body!.access_token as string);
    return body!.access_token as string;
  },

  me: () => request<User>("/auth/me"),
  profile: () => request<User>("/profile"),
  weather: () => request<Weather>("/weather"),
  searchLocations: (q: string) =>
    request<LocationCandidate[]>(`/profile/location/search?q=${encodeURIComponent(q)}`),
  setLocation: (city: string, lat?: number, lon?: number) =>
    request<User>("/profile/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, lat, lon }),
    }),
  updateProfile: (
    data: Partial<{ city: string; lat: number; lon: number; style_preferences: Record<string, unknown> }>
  ) =>
    request<User>("/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<User>("/profile/avatar", { method: "POST", body: fd });
  },
  removeAvatar: () => request<User>("/profile/avatar", { method: "DELETE" }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ detail: string }>("/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password, new_password }),
    }),
  deleteAccount: () => request<void>("/profile", { method: "DELETE" }),

  // Raw fetch: the response is a JSON file to download, not an object to parse.
  exportData: async () => {
    const res = await safeFetch("/api/profile/export", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new ApiError(res.status, "Couldn't export your data. Please try again.");
    return res.blob();
  },

  listGarments: () => request<Garment[]>("/wardrobe/items"),
  uploadGarment: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<Garment>("/wardrobe/items", { method: "POST", body: fd });
  },
  updateGarment: (id: number, tags: Partial<Garment>) =>
    request<Garment>(`/wardrobe/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tags),
    }),
  deleteGarment: (id: number) =>
    request<void>(`/wardrobe/items/${id}`, { method: "DELETE" }),
  retagGarment: (id: number) =>
    request<Garment>(`/wardrobe/items/${id}/retag`, { method: "POST" }),
  searchClothing: (q: string) =>
    request<Product[]>(`/wardrobe/search?q=${encodeURIComponent(q)}`),
  addGarmentFromWeb: (image_url: string, title?: string) =>
    request<Garment>("/wardrobe/items/from-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url, title }),
    }),

  listEvents: () => request<CalendarEvent[]>("/calendar/events"),
  createEvent: (data: { title: string; date: string; event_type: string; notes?: string }) =>
    request<CalendarEvent>("/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteEvent: (id: number) =>
    request<void>(`/calendar/events/${id}`, { method: "DELETE" }),

  today: () =>
    request<OutfitRecommendation>(`/recommendations/today?date=${localISODate()}`),
  buyNext: () => request<BuyNext>("/recommendations/buy-next"),

  tryOn: (photo: Blob, target: { garment_id: number } | { image_url: string }) => {
    const fd = new FormData();
    fd.append("photo", photo, "photo.jpg");
    if ("garment_id" in target) fd.append("garment_id", String(target.garment_id));
    else fd.append("image_url", target.image_url);
    return request<{ image_base64: string }>("/tryon", { method: "POST", body: fd });
  },

  dresserAIChat: (messages: ChatMessage[]) =>
    request<{ reply: string }>("/dresser-ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }),

  billingStatus: () => request<BillingStatus>("/billing/status"),
  checkout: () => request<{ url: string }>("/billing/checkout", { method: "POST" }),
  portal: () => request<{ url: string }>("/billing/portal", { method: "POST" }),
};
