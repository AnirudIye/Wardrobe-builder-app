// Animated stat number. Parses a stat string into prefix + number + suffix and
// counts the number up from 0 the first time it scrolls into view. Renders the
// real final value by default, so with reduced motion / no IntersectionObserver
// (or if the animation never runs) it still shows the correct number.
import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "../animations";

/** "$5/mo" -> {prefix:"$", num:5, suffix:"/mo"}; "7-day" -> {"",7,"-day"};
 *  a value with no leading number -> {prefix:"", num:null, suffix:value}. */
export function parseStat(v: string): { prefix: string; num: number | null; suffix: string } {
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(v);
  if (!m) return { prefix: "", num: null, suffix: v };
  return { prefix: m[1], num: Number(m[2].replace(/,/g, "")), suffix: m[3] };
}

export default function CountUp({ value, className }: { value: string; className?: string }) {
  const { prefix, num, suffix } = parseStat(value);
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (num === null) return;
    const el = numRef.current;
    if (!el) return;
    // Leave the real number rendered under reduced motion or without IO.
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !done) {
            done = true;
            const obj = { n: 0 };
            el.textContent = "0";
            animate(obj, {
              n: num,
              duration: 1100,
              ease: "outExpo",
              onUpdate: () => {
                el.textContent = String(Math.round(obj.n));
              },
              onComplete: () => {
                el.textContent = String(num);
              },
            });
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  if (num === null) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {prefix}
      <span ref={numRef}>{num}</span>
      {suffix}
    </span>
  );
}
