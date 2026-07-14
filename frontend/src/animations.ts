// Shared anime.js (v4) helpers so motion feels consistent across the app.
import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";

/** Fade + rise the element in (used for page/section entrances). */
export function fadeRise(el: Element | null, delay = 0) {
  if (!el) return;
  animate(el, {
    opacity: [0, 1],
    translateY: [14, 0],
    duration: 500,
    delay,
    ease: "outQuad",
  });
}

/** Staggered entrance for a container's children (grids, lists). */
export function staggerChildren(container: Element | null, selector = ":scope > *") {
  if (!container) return;
  const children = container.querySelectorAll(selector);
  if (children.length === 0) return;
  animate(children, {
    opacity: [0, 1],
    translateY: [16, 0],
    scale: [0.97, 1],
    duration: 450,
    delay: stagger(55),
    ease: "outQuad",
  });
}

/** Gentle attention pulse (e.g. when new content pops in). */
export function pulse(el: Element | null) {
  if (!el) return;
  animate(el, { scale: [1, 1.03, 1], duration: 350, ease: "inOutQuad" });
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
