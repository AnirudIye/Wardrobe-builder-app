// Click Spark (reactbits.dev-style): radiating spark lines on every click.
// Canvas overlay, zero dependencies.
import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

interface Props {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children: React.ReactNode;
}

export default function ClickSpark({
  sparkColor = "#FA9EBC",
  sparkSize = 11,
  sparkRadius = 22,
  sparkCount = 8,
  duration = 450,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) {
        sparksRef.current.push({
          x: e.clientX,
          y: e.clientY,
          angle: (2 * Math.PI * i) / sparkCount,
          startTime: now,
        });
      }
    };
    window.addEventListener("click", onClick);

    let raf = 0;
    const easeOut = (t: number) => t * (2 - t);
    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter((s) => {
        const elapsed = now - s.startTime;
        if (elapsed >= duration) return false;
        const progress = easeOut(elapsed / duration);
        const dist = progress * sparkRadius;
        const lineLength = sparkSize * (1 - progress);
        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.globalAlpha = 1 - progress;
        ctx.beginPath();
        ctx.moveTo(s.x + dist * Math.cos(s.angle), s.y + dist * Math.sin(s.angle));
        ctx.lineTo(
          s.x + (dist + lineLength) * Math.cos(s.angle),
          s.y + (dist + lineLength) * Math.sin(s.angle)
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[9999]"
        aria-hidden="true"
      />
      {children}
    </>
  );
}
