"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherAntigravityProps {
  color?: string;
  count?: number;
  speed?: number;
  className?: string;
  children?: React.ReactNode;
}

type Mote = { x: number; y: number; r: number; vx: number };

/**
 * DitherAntigravity — motes drift upward (anti-gravity) with a sinusoidal
 * horizontal sway, recycling to the bottom when they exit the top. Drawn on a
 * canvas overlay via a continuous `requestAnimationFrame` loop. Honors
 * `prefers-reduced-motion` (no loop).
 *
 * React port of Antigravity.vue.
 */
export function DitherAntigravity({
  color = "#7CFF67",
  count = 40,
  speed = 1,
  className,
  children,
}: DitherAntigravityProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const motesRef = useRef<Mote[]>([]);
  const rafRef = useRef(0);
  const sizeRef = useRef({ W: 1, H: 1 });

  function resize() {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    const W = (c.width = Math.max(1, r.width));
    const H = (c.height = Math.max(1, r.height));
    sizeRef.current = { W, H };
  }

  function init() {
    const { W, H } = sizeRef.current;
    motesRef.current = Array.from({ length: Math.max(1, Math.round(count)) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.3,
    }));
  }

  function frame() {
    rafRef.current = requestAnimationFrame(frame);
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { W, H } = sizeRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color;
    for (const m of motesRef.current) {
      m.y -= speed * (0.2 + m.r * 0.15);
      m.x += m.vx + Math.sin(m.y * 0.03) * 0.3;
      if (m.y < -m.r) {
        m.y = H + m.r;
        m.x = Math.random() * W;
      }
      ctx.globalAlpha = 0.3 + m.r * 0.2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  useEffect(() => {
    resize();
    init();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (!pixelPrefersReducedMotion()) rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // init reads sizeRef set by resize; both run synchronously above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, speed, color]);

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      {children}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
}
