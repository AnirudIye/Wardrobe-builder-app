// Ambient vector field behind the hero: soft blush particles drifting slowly
// with faint navy links between near neighbours. Self-contained <canvas>, DPR
// aware, re-sized to its parent. The rAF loop is paused when the canvas scrolls
// offscreen and when the tab is hidden; under prefers-reduced-motion it paints a
// single static frame. Purely decorative (pointer-events-none, aria-hidden).
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../animations";

type P = { x: number; y: number; vx: number; vy: number; r: number };

export default function HeroField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduce = prefersReducedMotion();
    const NAVY = "11,25,87";
    const BLUSH = "250,158,188";
    const LINK = 130;

    let W = 0;
    let H = 0;
    let particles: P[] = [];
    let raf = 0;
    let running = false;
    let onscreen = true;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const build = () => {
      const count = Math.max(24, Math.min(80, Math.round((W * H) / 16000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rand(-0.16, 0.16),
        vy: rand(-0.16, 0.16),
        r: rand(1.1, 2.6),
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(${NAVY},${0.14 * (1 - Math.sqrt(d2) / LINK)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx.fillStyle = `rgba(${BLUSH},0.55)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -12) p.x = W + 12;
        else if (p.x > W + 12) p.x = -12;
        if (p.y < -12) p.y = H + 12;
        else if (p.y > H + 12) p.y = -12;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const shouldRun = () => onscreen && !document.hidden && !reduce;
    const start = () => {
      if (running || !shouldRun()) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    const resize = () => {
      W = parent.clientWidth;
      H = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(); // always paint one frame immediately (no blank flash, verifiable)
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (es) => {
              onscreen = es[0].isIntersecting;
              onscreen ? start() : stop();
            },
            { threshold: 0 },
          )
        : null;
    if (io) io.observe(canvas);
    else start();

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} aria-hidden="true" />;
}
