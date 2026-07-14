// Thin typed client for the BetterDresser API.
// All requests go through /api, which Vite proxies to the FastAPI backend.

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = body?.detail ?? res.statusText;
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body as T;
}

// --- Types ---
export interface User {
  id: number;
  email: string;
  plan: string;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
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
  remaining_this_week: number | null;
  weekly_limit: number;
}

// --- Endpoints ---
export const api = {
  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  login: async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password });
    const res = await fetch("/api/auth/login", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) throw new ApiError(res.status, body?.detail ?? "Login failed");
    setToken(body.access_token);
    return body.access_token as string;
  },

  me: () => request<User>("/auth/me"),
  profile: () => request<User>("/profile"),
  weather: () => request<Weather>("/weather"),
  setLocation: (city: string) =>
    request<User>("/profile/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city }),
    }),
  updateProfile: (data: Partial<{ city: string; lat: number; lon: number }>) =>
    request<User>("/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

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

  today: () => request<OutfitRecommendation>("/recommendations/today"),
  buyNext: () => request<BuyNext>("/recommendations/buy-next"),

  billingStatus: () => request<BillingStatus>("/billing/status"),
  checkout: () => request<{ url: string }>("/billing/checkout", { method: "POST" }),
  portal: () => request<{ url: string }>("/billing/portal", { method: "POST" }),
};
