import { useEffect, useRef, useState } from "react";
import { api, Garment, Product } from "../api";
import { useFadeRise, useStaggerReveal, pulse } from "../animations";
import CameraCapture from "../components/CameraCapture";
import CircularGallery from "../components/CircularGallery";
import WeatherWidget from "../components/WeatherWidget";
import ConfirmDialog from "../components/ConfirmDialog";
import { CardGridSkeleton, Skeleton } from "../components/Skeleton";
import { garmentsCache } from "../store";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Wardrobe as WardrobeIll } from "../components/illustrations";

const CATEGORIES = ["top", "bottom", "outerwear", "dress", "footwear", "accessory", "other"];

// Items we've already sent for AI estimation this session — never re-fire for
// the same item (even on failure), so a missing AI key can't cause retry loops.
const retagAttempted = new Set<number>();

export default function Wardrobe() {
  const [items, setItems] = useState<Garment[]>(garmentsCache.peek() ?? []);
  const [loading, setLoading] = useState(garmentsCache.peek() === null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Web search state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const pageRef = useFadeRise<HTMLDivElement>();
  const gridRef = useStaggerReveal<HTMLDivElement>(loading ? null : items.length);
  const resultsRef = useStaggerReveal<HTMLDivElement>(results?.length ?? null);

  const syncItems = (next: Garment[]) => {
    garmentsCache.set(next);
    setItems(next);
  };

  useEffect(() => {
    garmentsCache.get().then((g) => {
      setItems(g);
      setLoading(false);
    });
  }, []);

  // AI warmth estimation: any item missing a warmth rating gets re-tagged in
  // the background; results stream into the grid as they arrive.
  useEffect(() => {
    items
      .filter((g) => g.warmth_rating == null && !retagAttempted.has(g.id))
      .forEach((g) => {
        retagAttempted.add(g.id);
        api
          .retagGarment(g.id)
          .then((updated) => {
            garmentsCache.update((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
            setItems(garmentsCache.peek() ?? []);
          })
          .catch(() => {});
      });
  }, [items]);

  const addPhotoFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const created = await api.uploadGarment(file);
      syncItems([created, ...(garmentsCache.peek() ?? items)]);
      pulse(gridRef.current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await addPhotoFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onCameraCapture = (blob: Blob) => {
    setCameraOpen(false);
    addPhotoFile(new File([blob], "camera.jpg", { type: "image/jpeg" }));
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await api.searchClothing(query.trim());
      setResults(found);
      if (found.length === 0) {
        setSearchError("No products found. Try a different search.");
      }
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const addFromWeb = async (p: Product) => {
    if (!p.thumbnail && !p.link) return;
    const imageUrl = p.thumbnail ?? "";
    setAddingUrl(imageUrl);
    setSearchError(null);
    try {
      const created = await api.addGarmentFromWeb(imageUrl, p.title);
      syncItems([created, ...items]);
      pulse(gridRef.current);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setAddingUrl(null);
    }
  };

  // Optimistic: apply the tag change immediately, roll back if the API rejects it.
  const patchItem = (id: number, tags: Partial<Garment>) => {
    const before = items;
    syncItems(items.map((g) => (g.id === id ? { ...g, ...tags } : g)));
    api.updateGarment(id, tags).then(
      (updated) => syncItems((garmentsCache.peek() ?? []).map((g) => (g.id === id ? updated : g))),
      (err) => {
        syncItems(before);
        setError((err as Error).message);
      }
    );
  };

  // Optimistic: remove immediately, restore on failure.
  const removeItem = (id: number) => {
    const before = items;
    syncItems(items.filter((g) => g.id !== id));
    api.deleteGarment(id).catch((err) => {
      syncItems(before);
      setError((err as Error).message);
    });
  };

  return (
    <div ref={pageRef}>
      <PageHeader
        title="My Wardrobe"
        context={
          loading
            ? "Opening your closet…"
            : `${items.length} ${items.length === 1 ? "piece" : "pieces"} catalogued`
        }
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setCameraOpen((v) => !v)}
              className="clay-btn-blush px-4 py-2 text-sm"
            >
              {cameraOpen ? "Close camera" : "Use camera"}
            </button>
            <label className="clay-btn px-5 py-2 text-sm cursor-pointer">
              {uploading ? "Uploading…" : "+ Add photo"}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
            </label>
          </div>
        }
      />

      {cameraOpen && (
        <CameraCapture
          title="Photograph a garment"
          onCapture={onCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <ErrorNote message={error} className="mb-4" />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Main column: the closet itself */}
        <div className="lg:col-span-2">
          {loading ? (
            <CardGridSkeleton count={6} cols="grid-cols-2 sm:grid-cols-3" />
          ) : items.length === 0 ? (
            <EmptyState
              Ill={WardrobeIll}
              title="Your closet is empty"
              body="Upload a photo of any garment, or search the web in the panel alongside. The AI tags category, colour and warmth as each piece lands."
            />
          ) : (
            <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {items.map((g) => (
                <div key={g.id} className="clay-card clay-card-hover overflow-hidden flex flex-col">
                  <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                  <div className="p-3.5 flex-1 flex flex-col gap-2 text-sm">
                    {g.subcategory && (
                      <p className="font-medium capitalize leading-snug line-clamp-1">{g.subcategory}</p>
                    )}
                    <select
                      value={g.category ?? ""}
                      onChange={(e) => patchItem(g.id, { category: e.target.value })}
                      className="w-full clay-input px-3 py-1.5 text-sm"
                    >
                      <option value="">Category</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {/* Warmth is AI-estimated, not user-set */}
                    <p className="text-xs text-navy/50 mt-auto">
                      {g.warmth_rating != null ? (
                        <>
                          Warmth {g.warmth_rating}/5 <span className="text-navy/30">· AI</span>
                        </>
                      ) : (
                        <span className="italic animate-pulse text-navy/40">AI estimating warmth…</span>
                      )}
                      {g.colors.length > 0 && <span> · {g.colors.join(", ")}</span>}
                    </p>
                    <button
                      onClick={() => setConfirmId(g.id)}
                      className="self-start text-blush-deep text-xs font-medium hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rail: weather + add-from-web */}
        <aside className="space-y-6">
          <WeatherWidget />

          <div className="clay-card p-5">
            <h3 className="font-semibold">Add from the web</h3>
            <p className="text-sm text-navy/50 mt-1 mb-3">
              Search real products and file them straight into your closet.
            </p>
            <form onSubmit={search} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="tan trench coat…"
                className="flex-1 min-w-0 clay-input text-sm"
              />
              <button
                type="submit"
                disabled={searching || query.trim().length < 2}
                className="clay-btn px-4 py-2 text-sm"
              >
                {searching ? "…" : "Search"}
              </button>
            </form>
            <ErrorNote message={searchError} className="mt-3" />
            {searching && !results && (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/3 mt-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results && results.length > 0 && (
              <div ref={resultsRef} className="mt-4 space-y-3">
                {results.map((p, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    {p.thumbnail && (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="w-14 h-14 shrink-0 object-contain bg-white rounded-xl shadow-clay-sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs line-clamp-2">{p.title}</p>
                      {p.price && <p className="text-xs font-semibold mt-0.5">{p.price}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => addFromWeb(p)}
                        disabled={addingUrl !== null || !p.thumbnail}
                        className="clay-btn text-xs py-1 px-3"
                      >
                        {addingUrl === p.thumbnail ? "…" : "Add"}
                      </button>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                          className="clay-btn-blush text-xs py-1 px-3 text-center"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Circular gallery of the closet (needs 3+ items to form a ring) */}
      {!loading && items.length >= 3 && (
        <div className="clay-card mt-8 py-2">
          <CircularGallery
            images={items.map((g) => ({ src: g.thumbnail_url, alt: g.subcategory ?? "" }))}
          />
          <p className="text-center text-xs text-navy/40 pb-2 -mt-1">drag to spin your closet</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete item?"
        message="This removes the item from your wardrobe. This can't be undone."
        onConfirm={() => {
          if (confirmId !== null) removeItem(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
