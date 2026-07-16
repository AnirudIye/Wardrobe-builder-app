// Word-by-word text reveal (reactbits-style) driven by anime.js: each word
// rises + fades (+ a soft blur) in sequence on mount. Newlines in `text` become
// line breaks; words at index >= accentFrom get the accent class. Degrades
// gracefully: under reduced motion the text is shown immediately, and a safety
// timer guarantees the words are never left hidden if the animation never runs.
import { Fragment, useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { prefersReducedMotion } from "../animations";

export default function SplitText({
  text,
  className = "",
  accentClass = "text-blush-deep",
  accentFrom,
  delay = 0,
}: {
  text: string;
  className?: string;
  accentClass?: string;
  accentFrom?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    if (words.length === 0) return;

    const show = (w: HTMLElement) => {
      w.style.opacity = "1";
      w.style.filter = "";
      w.style.transform = "";
    };

    if (prefersReducedMotion()) {
      words.forEach(show);
      return;
    }

    animate(words, {
      opacity: [0, 1],
      translateY: [18, 0],
      filter: ["blur(8px)", "blur(0px)"],
      duration: 700,
      delay: stagger(60, { start: delay }),
      ease: "outQuad",
      onComplete: () => words.forEach(show),
    });

    // Fail open: if frames never run (e.g. the animation engine stalls), don't
    // leave the headline invisible.
    const t = window.setTimeout(() => {
      words.forEach((w) => {
        if (getComputedStyle(w).opacity === "0") show(w);
      });
    }, 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let idx = 0;
  const lines = text.split("\n");
  return (
    <span ref={ref} className={className}>
      {lines.map((line, li) => {
        const parts = line.split(" ");
        return (
          <span key={li} className="block">
            {parts.map((word, wi) => {
              const accent = accentFrom !== undefined && idx >= accentFrom;
              idx += 1;
              return (
                <Fragment key={wi}>
                  <span
                    data-w
                    className={`inline-block ${accent ? accentClass : ""}`}
                    style={{ opacity: 0, willChange: "transform, opacity, filter" }}
                  >
                    {word}
                  </span>
                  {wi < parts.length - 1 ? " " : ""}
                </Fragment>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
