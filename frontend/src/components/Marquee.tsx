// Seamless infinite horizontal scroller (reactbits-style, self-contained).
// Renders `children` as one measured "set", duplicates the set enough times to
// always overflow its container, then translates the track by exactly one set
// width on an infinite linear loop — so the wrap is seamless with no gap or
// jump regardless of viewport width. Re-measures on resize, pauses on hover,
// and stays static under prefers-reduced-motion.
import { useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../animations";

export default function Marquee({
  children,
  speed = 40,
  gap = 40,
  pauseOnHover = true,
  className = "",
}: {
  children: React.ReactNode;
  /** Scroll speed in pixels per second. */
  speed?: number;
  /** Gap (px) between items and between repeated sets, kept uniform. */
  gap?: number;
  pauseOnHover?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [copies, setCopies] = useState(2);
  const reduce = prefersReducedMotion();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const set = setRef.current;
    const track = trackRef.current;
    if (!container || !set || !track) return;

    const setup = () => {
      const setW = set.offsetWidth;
      if (!setW) return;
      // Enough copies that a full set still covers the viewport at max shift.
      const need = Math.ceil(container.offsetWidth / setW) + 1;
      if (need !== copies) {
        setCopies(need); // re-render, effect re-runs with the new count
        return;
      }
      animRef.current?.cancel();
      animRef.current = null;
      if (reduce) return; // static filled ribbon, no motion
      animRef.current = track.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(${-setW}px)` }],
        { duration: (setW / speed) * 1000, iterations: Infinity, easing: "linear" },
      );
    };

    setup();
    const ro = new ResizeObserver(() => setup());
    ro.observe(container);
    ro.observe(set);
    return () => {
      ro.disconnect();
      animRef.current?.cancel();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copies, speed, reduce]);

  const pause = () => pauseOnHover && animRef.current?.pause();
  const resume = () => pauseOnHover && animRef.current?.play();

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? setRef : undefined}
            className="flex shrink-0 items-center"
            style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
            aria-hidden={i > 0 ? true : undefined}
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
