import { useEffect, useRef, useState } from "react";
import { api, Garment, Product } from "../api";
import { useFadeRise, useStaggerReveal, pulse } from "../animations";
import CircularGallery from "../components/CircularGallery";
import WeatherWidget from "../components/WeatherWidget";

const CATEGORIES = ["top", "bottom", "outerwear", "dress", "footwear", "accessory", "other"];

export default function Wardrobe() {
  const [items, setItems] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  const load = async () => {
    setItems(await api.listGarments());
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadGarment(file);
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
        setSearchError("No products found — try a different search.");
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
      await api.addGarmentFromWeb(imageUrl, p.title);
      await load();
      pulse(gridRef.current);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setAddingUrl(null);
    }
  };

  if (loading) return <p className="text-navy/50">Loading wardrobe…</p>;

  return (
    <div ref={pageRef}>
      <WeatherWidget />

      {/* Circular gallery of the closet (needs 3+ items to form a ring) */}
      {items.length >= 3 && (
        <div className="clay-card mb-6 py-2">
          <CircularGallery
            images={items.map((g) => ({ src: g.thumbnail_url, alt: g.subcategory ?? "" }))}
          />
          <p className="text-center text-xs text-navy/40 pb-2 -mt-1">drag to spin your closet</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Your wardrobe ({items.length})</h2>
        <label className="clay-btn px-5 py-2 text-sm cursor-pointer">
          {uploading ? "Uploading…" : "+ Add photo"}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </label>
      </div>

      {/* Add from the web */}
      <div className="clay-card p-6 mb-6">
        <h3 className="font-semibold mb-1">Add from the web</h3>
        <p className="text-sm text-navy/50 mb-3">
          Search the internet for clothing and add pieces straight to your wardrobe.
        </p>
        <form onSubmit={search} className="flex gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. tan trench coat, white sneakers…"
            className="flex-1 clay-input text-sm"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="clay-btn px-5 py-2 text-sm"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {searchError && <p className="text-sm text-red-500 mt-2">{searchError}</p>}
        {results && results.length > 0 && (
          <div ref={resultsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {results.map((p, i) => (
              <div
                key={i}
                className="clay-card clay-card-hover p-3 flex flex-col"
              >
                {p.thumbnail && (
                  <img
                    src={p.thumbnail}
                    alt=""
                    className="w-full aspect-square object-contain rounded-xl"
                  />
                )}
                <p className="text-xs mt-2 line-clamp-2 flex-1">{p.title}</p>
                {p.price && <p className="text-xs font-semibold mt-1">{p.price}</p>}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => addFromWeb(p)}
                    disabled={addingUrl !== null || !p.thumbnail}
                    className="flex-1 clay-btn text-xs py-1.5"
                  >
                    {addingUrl === p.thumbnail ? "Adding…" : "+ Add"}
                  </button>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="clay-btn-blush text-xs py-1.5 px-3"
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

      {items.length === 0 ? (
        <p className="text-navy/50">
          No items yet. Upload a photo or search the web to start your wardrobe.
        </p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {items.map((g) => (
            <div key={g.id} className="clay-card clay-card-hover overflow-hidden">
              <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
              <div className="p-3 space-y-2 text-sm">
                {g.subcategory && (
                  <span className="clay-chip inline-block line-clamp-1">{g.subcategory}</span>
                )}
                <select
                  value={g.category ?? ""}
                  onChange={(e) => patchItem(g.id, { category: e.target.value })}
                  className="w-full clay-input px-3 py-1.5 text-sm"
                >
                  <option value="">— category —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-navy/50">Warmth</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={g.warmth_rating ?? ""}
                    onChange={(e) =>
                      patchItem(g.id, { warmth_rating: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-16 clay-input px-3 py-1.5 text-sm"
                  />
                </div>
                {g.colors.length > 0 && <p className="text-navy/50">{g.colors.join(", ")}</p>}
                <button
                  onClick={() => removeItem(g.id)}
                  className="text-blush-deep text-xs font-medium hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  async function patchItem(id: number, tags: Partial<Garment>) {
    const updated = await api.updateGarment(id, tags);
    setItems((prev) => prev.map((g) => (g.id === id ? updated : g)));
  }

  async function removeItem(id: number) {
    await api.deleteGarment(id);
    setItems((prev) => prev.filter((g) => g.id !== id));
  }
}
