import { useEffect, useRef, useState } from "react";
import { api, ApiError, Garment } from "../api";
import { useFadeRise } from "../animations";
import { garmentsCache } from "../store";
import { getCachedBuyNext } from "./BuyNext";

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
  const buyNext = getCachedBuyNext();
  const [selected, setSelected] = useState<Target | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    garmentsCache.get().then(setGarments).catch(() => {});
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
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

  return (
    <div ref={pageRef}>
      <h2 className="text-xl font-semibold mb-1">TryOn</h2>
      <p className="text-sm text-navy/50 mb-4">
        Snap a photo and see yourself in a piece from your wardrobe or a Buy Next pick. Your
        photo is sent to Google's AI to generate the try-on image and isn't stored by
        BetterDresser.
      </p>

      {/* Step 1: photo */}
      <div className="clay-card p-5 mb-6">
        <h3 className="font-semibold mb-3">1. Your photo</h3>
        {photoPreview ? (
          <div className="flex items-center gap-4">
            <img src={photoPreview} alt="Captured" className="w-32 h-32 object-cover rounded-2xl shadow-clay-sm" />
            <button onClick={retake} className="clay-btn-blush px-4 py-1.5 text-sm">
              Retake
            </button>
          </div>
        ) : streamActive ? (
          <div className="flex flex-col items-start gap-3">
            <video
              ref={videoRef}
              className="w-full max-w-sm rounded-2xl shadow-clay-sm bg-navy/10"
              playsInline
              muted
            />
            <button onClick={capture} className="clay-btn px-5 py-2 text-sm">
              Capture
            </button>
          </div>
        ) : (
          <div>
            <button onClick={startCamera} className="clay-btn px-5 py-2 text-sm">
              Enable camera
            </button>
            {cameraError && <p className="text-sm text-red-500 mt-2">{cameraError}</p>}
          </div>
        )}
        <canvas ref={canvasRef} hidden />
      </div>

      {/* Step 2: garment */}
      <div className="clay-card p-5 mb-6">
        <h3 className="font-semibold mb-3">2. Pick something to try on</h3>
        {garments.length === 0 && !buyNext?.suggestions.length && (
          <p className="text-sm text-navy/40">
            Add items to your wardrobe or get Buy Next suggestions first.
          </p>
        )}
        {garments.length > 0 && (
          <>
            <p className="text-xs text-navy/40 mb-2">From your wardrobe</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-4">
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
        {buyNext && buyNext.suggestions.some((s) => s.products.length > 0) && (
          <>
            <p className="text-xs text-navy/40 mb-2">From Buy Next</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
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
          </>
        )}
      </div>

      {/* Step 3: generate */}
      <button
        onClick={generate}
        disabled={!photoBlob || !selected || busy}
        className="clay-btn px-6 py-3 w-full sm:w-auto"
      >
        {busy ? "Generating your look…" : "Try it on"}
      </button>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      {resultUrl && (
        <div className="clay-card p-5 mt-6 max-w-sm">
          <h3 className="font-semibold mb-3">Your try-on</h3>
          <img src={resultUrl} alt="Try-on result" className="w-full rounded-2xl shadow-clay-sm" />
        </div>
      )}
    </div>
  );
}
