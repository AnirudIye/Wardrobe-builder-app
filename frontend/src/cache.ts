// Tiny session cache shared across tabs. Each resource gets a cached fetcher
// with in-flight dedupe (survives tab switches, clears on refresh) so
// navigating around the app never refetches data it already has, and React
// StrictMode double-mounts never fire duplicate requests.

export interface CachedResource<T> {
  /** Cached value if present, else fetch (deduped) and cache. */
  get(force?: boolean): Promise<T>;
  /** Current cached value without fetching. */
  peek(): T | null;
  /** Replace the cached value (e.g. after an optimistic mutation). */
  set(value: T): void;
  /** Update the cached value in place if present. */
  update(fn: (current: T) => T): void;
  /** Drop the cache so the next get() refetches. */
  clear(): void;
}

export function createCachedResource<T>(fetcher: () => Promise<T>): CachedResource<T> {
  let value: T | null = null;
  let inflight: Promise<T> | null = null;

  return {
    async get(force = false) {
      if (!force && value !== null) return value;
      if (!inflight) {
        inflight = fetcher().finally(() => {
          inflight = null;
        });
      }
      value = await inflight;
      return value;
    },
    peek: () => value,
    set(v: T) {
      value = v;
    },
    update(fn) {
      if (value !== null) value = fn(value);
    },
    clear() {
      value = null;
    },
  };
}
