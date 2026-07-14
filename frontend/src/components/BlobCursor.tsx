// Blob Cursor (reactbits.dev-style): gooey blobs that trail the pointer.
// SVG "goo" filter + requestAnimationFrame lerp; no dependencies.
// Pointer-events: none, so it never interferes with the UI. Skipped on touch.
import { useEffect, useRef } from "react";

const BLOBS = [
  { size: 64, lerp: 0.35, opacity: 0.5 },
  { size: 46, lerp: 0.18, opacity: 0.42 },
  { size: 30, lerp: 0.09, opacity: 0.38 },
];

export default function BlobCursor({ color = "#FA9EBC" }: { color?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip on touch-primary devices — no persistent cursor to follow.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const blobs = Array.from(
      containerRef.current?.children ?? []
    ) as HTMLElement[];
    const mouse = { x: -100, y: -100 };
    const pos = BLOBS.map(() => ({ x: -100, y: -100 }));

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      BLOBS.forEach((cfg, i) => {
        pos[i].x += (mouse.x - pos[i].x) * cfg.lerp;
        pos[i].y += (mouse.y - pos[i].y) * cfg.lerp;
        const el = blobs[i];
        if (el) {
          el.style.transform = `translate(${pos[i].x - cfg.size / 2}px, ${
            pos[i].y - cfg.size / 2
          }px)`;
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <filter id="blob-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
          />
        </filter>
      </svg>
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-[9998] hidden md:block"
        style={{ filter: "url(#blob-goo)" }}
        aria-hidden="true"
      >
        {BLOBS.map((b, i) => (
          <div
            key={i}
            className="absolute top-0 left-0 rounded-full"
            style={{
              width: b.size,
              height: b.size,
              background: color,
              opacity: b.opacity,
              willChange: "transform",
            }}
          />
        ))}
      </div>
    </>
  );
}
