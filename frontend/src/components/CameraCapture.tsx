// Inline camera panel: opens the camera on mount, hands back a JPEG blob on
// capture, and always releases the stream (camera light) on unmount. Modeled
// on TryOn's flow, including its guard against capturing before frames arrive.
import { useEffect, useRef, useState } from "react";
import ErrorNote from "./ErrorNote";

export default function CameraCapture({
  title = "Take a photo",
  onCapture,
  onClose,
}: {
  title?: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = videoRef.current;
        if (!video || cancelled) {
          // Never leave an unattached stream running.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't access your camera. Check your browser's permission settings and try again."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      // No frames yet — capturing now would produce an empty image.
      setError("The camera preview isn't ready yet. Give it a second and try again.");
      return;
    }
    setError(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't capture that frame. Try again.");
          return;
        }
        onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="clay-card blob-card-a p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onClose} className="text-xs text-navy/40 hover:text-navy transition-colors">
          Cancel
        </button>
      </div>
      <video ref={videoRef} playsInline muted className="w-full max-w-md rounded-2xl bg-navy/5" />
      <canvas ref={canvasRef} hidden />
      <ErrorNote message={error} className="mt-3" />
      <div className="mt-4">
        <button onClick={capture} disabled={!ready} className="clay-btn px-6 py-2 text-sm">
          Capture
        </button>
      </div>
    </div>
  );
}
