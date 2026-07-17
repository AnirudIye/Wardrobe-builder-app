import { useEffect, useRef, useState } from "react";
import { api, ApiError, Garment } from "../api";
import { useFadeRise } from "../animations";
import { garmentsCache } from "../store";
import { fetchBuyNext, getCachedBuyNext } from "./BuyNext";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { Mirror } from "../components/illustrations";

type Target =
  | { kind: "garment"; garment_id: number; thumb: string; label: string }
  | { kind: "product"; image_url: string; thumb: string; label: string };

export default function TryOn({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const pageRef = useFadeRise<HTMLDivElement>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [garments, setGarments] = useState<Garment[]>(garmentsCache.peek() ?? []);
  const [selected, setSelected] = useState<Target | null>(null);

  // Buy Next picks as try-on candidates. Seeded from the session cache; loading
  // is an explicit click because a fresh Buy Next run spends a daily credit.
  const [buyNext, setBuyNext] = useState(getCachedBuyNext());
  const [buyNextBusy, setBuyNextBusy] = useState(false);
  const [buyNextError, setBuyNextError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    garmentsCache.get().then(setGarments).catch(() => {});
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBuyNext = async () => {
    setBuyNextBusy(true);
    setBuyNextError(null);
    try {
      setBuyNext(await fetchBuyNext());
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        onQuotaBlocked();
        setBuyNextError(err.message);
      } else {
        setBuyNextError((err as Error).message);
      }
    } finally {
      setBuyNextBusy(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      if (!video) {
        // Never leave an unattached stream running (camera light stays on).
        stream.getTracks().forEach((t) => t.stop());
        setCameraError("Couldn't start the camera preview. Please try again.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStreamActive(true);
    } catch (err) {
      setCameraError(
        "Couldn't access your camera. Check your browser's permission settings and try again."
      );
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamActive(false);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      // No frames yet — capturing now would produce an empty image.
      setCameraError("The camera preview isn't ready yet. Give it a second and try again.");
      return;
    }
    setCameraError(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Couldn't capture that frame. Try again.");
          return;
        }
        setPhotoBlob(blob);
        setPhotoPreview(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9
    );
    stopCamera();
  };

  const retake = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    setResultUrl(null);
  };

  const generate = async () => {
    if (!photoBlob || !selected) return;
    setBusy(true);
    setError(null);
    setResultUrl(null);
    try {
      const target =
        selected.kind === "garment"
          ? { garment_id: selected.garment_id }
          : { image_url: selected.image_url };
      const { image_base64 } = await api.tryOn(photoBlob, target);
      setResultUrl(`data:image/png;base64,${image_base64}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        onQuotaBlocked();
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  const photoReady = photoPreview !== null;

  return (
    <div ref={pageRef}>
      <PageHeader
        title="TryOn"
        context="See a piece on you before you buy it. Your photo goes to Google's AI for the render and is never stored."
      />

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Panel: your photo */}
        <section className="clay-card blob-card-a p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Your photo</h3>
            {photoReady && <span className="clay-chip">ready</span>}
          </div>
          {photoPreview ? (
            <div className="flex items-center gap-4">
              <img src={photoPreview} alt="Captured" className="w-36 h-36 object-cover rounded-2xl shadow-clay-sm" />
              <button onClick={retake} className="clay-btn-blush px-4 py-1.5 text-sm">
                Retake
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              {/* Keep the <video> mounted even before the camera starts: startCamera
                  needs videoRef to exist to attach the stream (conditionally mounting
                  it left the ref null and the preview permanently blank). */}
              <video
                ref={videoRef}
                className={`w-full rounded-2xl shadow-clay-sm bg-navy/10 ${streamActive ? "" : "hidden"}`}
                playsInline
                muted
              />
              {streamActive ? (
                <button onClick={capture} className="clay-btn px-5 py-2 text-sm">
                  Capture
                </button>
              ) : (
                <button onClick={startCamera} className="clay-btn px-5 py-2 text-sm">
                  Enable camera
                </button>
              )}
              <ErrorNote message={cameraError} className="mt-1" />
            </div>
          )}
          <canvas ref={canvasRef} hidden />
        </section>

        {/* Panel: the piece */}
        <section className="clay-card blob-card-d p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">The piece</h3>
            {selected && <span className="clay-chip line-clamp-1 max-w-[12rem]">{selected.label}</span>}
          </div>

          {garments.length === 0 ? (
            <p className="text-sm text-navy/40 mb-4">
              Your wardrobe is empty. Add items to try them on, or load Buy Next picks below.
            </p>
          ) : (
            <>
              <p className="text-xs text-navy/40 mb-2">From your wardrobe</p>
              <div className="grid grid-cols-4 gap-3 mb-5">
                {garments.map((g) => {
                  const isSelected =
                    selected?.kind === "garment" && selected.garment_id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() =>
                        setSelected({
                          kind: "garment",
                          garment_id: g.id,
                          thumb: g.thumbnail_url,
                          label: g.subcategory ?? g.category ?? "item",
                        })
                      }
                      className={`rounded-2xl overflow-hidden shadow-clay-sm transition-all ${
                        isSelected ? "ring-4 ring-blush" : "hover:-translate-y-0.5"
                      }`}
                    >
                      <img src={g.thumbnail_url} alt="" className="w-full aspect-square object-cover" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Buy Next picks: grid when loaded this session, otherwise an explicit
              load button (a fresh run is quota-metered, so it's never automatic). */}
          <p className="text-xs text-navy/40 mb-2">From Buy Next</p>
          {buyNext ? (
            buyNext.suggestions.some((s) => s.products.length > 0) ? (
              <div className="grid grid-cols-4 gap-3">
                {buyNext.suggestions.flatMap((s) =>
                  s.products
                    .filter((p) => p.thumbnail)
                    .map((p, j) => {
                      const isSelected =
                        selected?.kind === "product" && selected.image_url === p.thumbnail;
                      return (
                        <button
                          key={`${s.description}-${j}`}
                          onClick={() =>
                            setSelected({
                              kind: "product",
                              image_url: p.thumbnail!,
                              thumb: p.thumbnail!,
                              label: p.title,
                            })
                          }
                          className={`rounded-2xl overflow-hidden shadow-clay-sm transition-all ${
                            isSelected ? "ring-4 ring-blush" : "hover:-translate-y-0.5"
                          }`}
                        >
                          <img src={p.thumbnail ?? undefined} alt="" className="w-full aspect-square object-contain bg-white" />
                        </button>
                      );
                    })
                )}
              </div>
            ) : (
              <p className="text-sm text-navy/40">No shoppable Buy Next picks right now.</p>
            )
          ) : (
            <div>
              <button
                onClick={loadBuyNext}
                disabled={buyNextBusy}
                className="clay-btn-blush px-4 py-2 text-sm"
              >
                {buyNextBusy ? "Finding picks…" : "Load Buy Next picks"}
              </button>
              <p className="text-[11px] text-navy/40 mt-1.5">
                Runs a Buy Next analysis (uses one daily credit on the free plan).
              </p>
              <ErrorNote message={buyNextError} className="mt-2" />
            </div>
          )}
        </section>
      </div>

      {/* Render */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={generate}
          disabled={!photoBlob || !selected || busy}
          className="clay-btn px-8 py-3"
        >
          {busy ? "Generating your look…" : "Try it on"}
        </button>
        {!photoBlob || !selected ? (
          <p className="text-sm text-navy/40">
            {photoBlob ? "Pick a piece to wear." : selected ? "Take your photo first." : "Take a photo and pick a piece."}
          </p>
        ) : null}
      </div>

      <ErrorNote message={error} className="mt-4" />

      {busy && !resultUrl && (
        <div className="clay-card blob-card-b p-6 mt-8 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 shrink-0"><Mirror className="w-full h-full" /></span>
            <h3 className="font-brand text-2xl tracking-tight">Your try-on</h3>
          </div>
          <Skeleton className="w-full aspect-[3/4] rounded-2xl" />
          <p className="text-xs text-navy/40 mt-3">This usually takes under a minute.</p>
        </div>
      )}
      {resultUrl && (
        <div className="clay-card blob-card-b p-6 mt-8 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 shrink-0"><Mirror className="w-full h-full" /></span>
            <h3 className="font-brand text-2xl tracking-tight">Your try-on</h3>
          </div>
          <img src={resultUrl} alt="Try-on result" className="w-full rounded-2xl shadow-clay-sm" />
        </div>
      )}
    </div>
  );
}
