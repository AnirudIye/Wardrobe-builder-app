import { useEffect, useRef, useState } from "react";
import { api, Garment } from "../api";

const CATEGORIES = ["top", "bottom", "outerwear", "dress", "footwear", "accessory", "other"];

export default function Wardrobe() {
  const [items, setItems] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const patch = async (id: number, tags: Partial<Garment>) => {
    const updated = await api.updateGarment(id, tags);
    setItems((prev) => prev.map((g) => (g.id === id ? updated : g)));
  };

  const remove = async (id: number) => {
    await api.deleteGarment(id);
    setItems((prev) => prev.filter((g) => g.id !== id));
  };

  if (loading) return <p className="text-neutral-500">Loading wardrobe…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Your wardrobe ({items.length})</h2>
        <label className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium cursor-pointer">
          {uploading ? "Uploading…" : "+ Add photo"}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-500">No items yet. Upload a photo of a clothing item to start.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((g) => (
            <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
              <div className="p-3 space-y-2 text-sm">
                <select
                  value={g.category ?? ""}
                  onChange={(e) => patch(g.id, { category: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2 py-1"
                >
                  <option value="">— category —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-neutral-500">Warmth</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={g.warmth_rating ?? ""}
                    onChange={(e) =>
                      patch(g.id, { warmth_rating: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-16 rounded border border-neutral-300 px-2 py-1"
                  />
                </div>
                {g.colors.length > 0 && (
                  <p className="text-neutral-500">{g.colors.join(", ")}</p>
                )}
                <button onClick={() => remove(g.id)} className="text-red-600 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
