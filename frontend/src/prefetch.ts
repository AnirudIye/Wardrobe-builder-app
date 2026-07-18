// Intent-driven image prefetch: warm the browser's image cache for pictures the
// user is *about to* see, using navigation intent as the signal (hovering or
// keyboard-focusing a nav tab — the same heuristic Next.js/instant.page use for
// links). By the time the click lands, the bytes are already cached and the
// destination renders its images instantly instead of popping in.
//
// Deduped (never fetch a URL twice), capped per call, low-priority so it never
// contends with what's on screen, and skipped entirely under data-saver.

import { garmentsCache } from "./store";
import { getCachedBuyNext } from "./pages/BuyNext";

const warmed = new Set<string>();

function saveData(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
}

/** Warm the cache for a list of image URLs (nulls/dupes ignored). */
export function prefetchImages(urls: (string | null | undefined)[], max = 24): void {
  if (saveData()) return;
  let n = 0;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    const img = new Image();
    img.decoding = "async";
    // fetchPriority is honored by Chromium; harmless where unsupported.
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
    img.src = url;
    if (++n >= max) break;
  }
}

/** The garment thumbnails currently known app-wide (Wardrobe / Today / TryOn). */
function garmentThumbs(): string[] {
  return (garmentsCache.peek() ?? []).map((g) => g.thumbnail_url);
}

/** Product thumbnails from the last Buy Next run (Buy Next / TryOn candidates). */
function buyNextThumbs(): string[] {
  const bn = getCachedBuyNext();
  if (!bn) return [];
  return bn.suggestions.flatMap((s) => s.products.map((p) => p.thumbnail ?? "")).filter(Boolean);
}

// Which images each tab will render. Only the image-heavy tabs are listed;
// Calendar / DresserAI / Plan have nothing to warm.
const TAB_IMAGES: Record<string, () => string[]> = {
  wardrobe: garmentThumbs,
  today: garmentThumbs, // outfits are assembled from the user's own garments
  "buy-next": buyNextThumbs,
  tryon: () => [...garmentThumbs(), ...buyNextThumbs()], // both are try-on candidates
};

/** Prefetch the images a tab is about to show. Call on hover/focus intent. */
export function prefetchTab(tab: string): void {
  const getter = TAB_IMAGES[tab];
  if (getter) prefetchImages(getter());
}
