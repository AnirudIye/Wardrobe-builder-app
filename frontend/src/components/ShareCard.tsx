// Share actions for the fit streak: a client-rendered PNG card (typographic
// only - no photos, so no cross-origin canvas taint and nothing private) plus
// a Wordle-style emoji text block. Comparison happens wherever the user
// pastes it; the app itself has no social surface.
import { useState } from "react";
import { FitStatus } from "../api";

const NAVY = "#0B1957";
const BLUSH_DEEP = "#F2769F";
const CREAM = "#FFF6EA";
const CREAM_DEEP = "#F7E9D4";

export function shareText(status: FitStatus): string {
  const squares = status.week.map((d) => (d.logged ? "⬛" : "⬜")).join("");
  return `BetterDresser streak ${status.current_streak} \u{1F525}\n${squares}\nCloset score ${status.closet_score}/100`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderCard(status: FitStatus): Promise<Blob> {
  // Make sure Ramaraja/Figtree are usable on the canvas before drawing.
  await document.fonts.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw the share card in this browser.");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Wordmark, split-colored like the app header.
  ctx.textBaseline = "alphabetic";
  ctx.font = "88px Ramaraja, serif";
  ctx.fillStyle = NAVY;
  const better = "Better";
  const betterWidth = ctx.measureText(better).width;
  const markWidth = betterWidth + ctx.measureText("Dresser").width;
  const markX = (W - markWidth) / 2;
  ctx.fillText(better, markX, 170);
  ctx.fillStyle = BLUSH_DEEP;
  ctx.fillText("Dresser", markX + betterWidth, 170);

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  ctx.fillStyle = "rgba(11, 25, 87, 0.5)";
  ctx.font = "40px Figtree, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dateLine, W / 2, 240);

  // The number is the whole story.
  ctx.fillStyle = NAVY;
  ctx.font = "430px Ramaraja, serif";
  ctx.fillText(String(status.current_streak), W / 2, 740);
  ctx.font = "54px Figtree, sans-serif";
  ctx.fillText(status.current_streak === 1 ? "day streak" : "day streak", W / 2, 830);

  // Week squares, Monday through Sunday.
  const size = 96;
  const gap = 28;
  const rowWidth = 7 * size + 6 * gap;
  let x = (W - rowWidth) / 2;
  const y = 950;
  for (const day of status.week) {
    roundedRect(ctx, x, y, size, size, 24);
    ctx.fillStyle = day.logged ? NAVY : CREAM_DEEP;
    ctx.fill();
    x += size + gap;
  }

  ctx.fillStyle = "rgba(11, 25, 87, 0.6)";
  ctx.font = "44px Figtree, sans-serif";
  ctx.fillText(
    `Closet score ${status.closet_score}/100 · ${status.week_points} style points this week`,
    W / 2,
    1180
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't export the share card."))),
      "image/png"
    );
  });
}

export default function ShareActions({ status }: { status: FitStatus }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await renderCard(status);
      const file = new File([blob], "betterdresser-streak.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareText(status) });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "betterdresser-streak.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // The user backing out of the OS share sheet is not an error.
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(shareText(status));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. You can screenshot the card instead.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button onClick={copy} className="clay-chip hover:bg-blush" disabled={busy}>
        {copied ? "Copied" : "Copy text"}
      </button>
      <button onClick={share} className="clay-btn px-5 py-2 text-sm" disabled={busy}>
        {busy ? "Rendering…" : "Share card"}
      </button>
    </div>
  );
}
