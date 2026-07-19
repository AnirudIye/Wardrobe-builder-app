// Shared anime.js (v4) helpers so motion feels consistent across the app.
import { animate, stagger } from "animejs";
import { useEffect, useLayoutEffect, useRef } from "react";

// Strong ease-out: built-in easings are too weak to read as intentional, and
// ease-out front-loads the movement right when the user is watching
// (emil-design-eng skill).
const EASE_OUT_STRONG = "cubicBezier(0.23, 1, 0.32, 1)";

/** True when the user has asked the OS to minimise motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Fade + rise the element in (used for page/section entrances). */
export function fadeRise(el: Element | null, delay = 0) {
  if (!el) return;
  animate(el, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 320,
    delay,
    ease: EASE_OUT_STRONG,
  });
}

/** Staggered entrance for a container's children (grids, lists). */
export function staggerChildren(container: Element | null, selector = ":scope > *") {
  if (!container) return;
  const children = container.querySelectorAll(selector);
  if (children.length === 0) return;
  animate(children, {
    opacity: [0, 1],
    translateY: [12, 0],
    scale: [0.97, 1],
    duration: 300,
    delay: stagger(40),
    ease: EASE_OUT_STRONG,
  });
}

/** Gentle attention pulse (e.g. when new content pops in). */
export function pulse(el: Element | null) {
  if (!el) return;
  animate(el, { scale: [1, 1.02, 1], duration: 250, ease: "inOutQuad" });
}

/** Hook: run a staggered reveal on the ref'd container whenever `key` changes. */
export function useStaggerReveal<T extends HTMLElement>(key: unknown, selector?: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (key !== null && key !== undefined && key !== false) {
      staggerChildren(ref.current, selector);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}

/** Hook: fade-rise the ref'd element on mount. */
export function useFadeRise<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    fadeRise(ref.current, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * Hook: reveal the ref'd element the first time it scrolls into view.
 * `stagger` reveals the element's direct children one-by-one (for grids/lists);
 * otherwise the element itself fade-rises. Runs once, then disconnects.
 * Honours prefers-reduced-motion by rendering everything visible immediately.
 */
export function useReveal<T extends HTMLElement>(
  opts: { stagger?: boolean; threshold?: number; delay?: number } = {},
) {
  const { stagger: doStagger = false, threshold = 0.15, delay = 0 } = opts;
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets: HTMLElement[] = doStagger
      ? Array.from(el.querySelectorAll<HTMLElement>(":scope > *"))
      : [el];
    const revealNow = () => targets.forEach((t) => (t.style.opacity = "1"));

    // Fail open: if the user minimises motion, or IntersectionObserver is
    // unavailable, just show the content - never leave it stuck hidden.
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      revealNow();
      return;
    }

    // Pre-hide before first paint so nothing flashes in, then reveal on scroll.
    targets.forEach((t) => (t.style.opacity = "0"));

    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !done) {
            done = true;
            if (doStagger) staggerChildren(el);
            else fadeRise(el, delay);
            io.disconnect();
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
