"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherSplashCursorProps {
  color?: string;
  maxRadius?: number;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

type Ripple = { x: number; y: number; t0: number };

/**
 * DitherSplashCursor — moving the pointer drops expanding ring ripples on a
 * canvas overlay; a new ripple spawns only after the pointer has moved >22px
 * from the last drop. A `requestAnimationFrame` loop runs only while ripples
 * are alive. Honors `prefers-reduced-motion` (moves are no-ops).
 *
 * React port of SplashCursor.vue.
 */
export function DitherSplashCursor({
  color = "#3DA5FF",
  maxRadius = 60,
  duration = 700,
  className,
  children,
}: DitherSplashCursorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });

  function resize() {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    c.width = Math.max(1, r.width);
    c.height = Math.max(1, r.height);
  }

  function frame(now: number) {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) {
      rafRef.current = 0;
      return;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    const ripples = ripplesRef.current.filter((r) => now - r.t0 < duration);
    ripplesRef.current = ripples;
    ctx.strokeStyle = color;
    for (const r of ripples) {
      const p = (now - r.t0) / duration;
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.lineWidth = 2 * (1 - p);
      ctx.beginPath();
      ctx.arc(r.x, r.y, p * maxRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    rafRef.current = ripples.length ? requestAnimationFrame(frame) : 0;
  }

  function onMove(e: React.PointerEvent) {
    if (pixelPrefersReducedMotion()) return;
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const last = lastRef.current;
    if (Math.hypot(x - last.x, y - last.y) < 22) return;
    lastRef.current = { x, y };
    ripplesRef.current.push({ x, y, t0: performance.now() });
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden", className)}
      onPointerMove={onMove}
    >
      {children}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
}
