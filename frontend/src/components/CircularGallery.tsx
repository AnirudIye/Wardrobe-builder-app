// Circular Gallery (reactbits.dev-style): images arranged on a 3D ring that
// slowly auto-rotates and can be dragged to spin. CSS 3D transforms, no deps.
import { useEffect, useRef } from "react";

interface Props {
  images: { src: string; alt?: string }[];
  height?: number;
}

export default function CircularGallery({ images, height = 230 }: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  const state = useRef({ angle: 0, velocity: 0.12, dragging: false, lastX: 0 });

  const count = images.length;
  // Ring radius grows with item count so cards don't overlap.
  const radius = Math.max(150, Math.round((count * 130) / (2 * Math.PI)));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = state.current;
      if (!s.dragging) {
        s.angle += s.velocity;
        // Ease drag-flick momentum back to the idle cruise speed.
        s.velocity += (0.12 - s.velocity) * 0.02;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translateZ(-${radius}px) rotateY(${s.angle}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [radius]);

  const onPointerDown = (e: React.PointerEvent) => {
    state.current.dragging = true;
    state.current.lastX = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    s.lastX = e.clientX;
    s.angle += dx * 0.35;
    s.velocity = dx * 0.35;
  };
  const endDrag = () => {
    state.current.dragging = false;
  };

  if (count < 3) return null;

  return (
    <div
      className="relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ height, perspective: 900 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        ref={ringRef}
        className="absolute inset-0 mx-auto"
        style={{ transformStyle: "preserve-3d", width: 1 }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="absolute rounded-2xl overflow-hidden shadow-clay bg-cream-soft"
            style={{
              width: 120,
              height: 150,
              left: -60,
              top: (height - 150) / 2,
              transform: `rotateY(${(360 / count) * i}deg) translateZ(${radius}px)`,
              backfaceVisibility: "hidden",
            }}
          >
            <img
              src={img.src}
              alt={img.alt ?? ""}
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
