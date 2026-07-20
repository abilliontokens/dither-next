"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherImageTrailProps {
  colors?: string[];
  size?: number;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

type Tile = { x: number; y: number; t0: number; color: string; rot: number };

/**
 * DitherImageTrail — moving the pointer drops rotating, shrinking, fading
 * colored squares on a canvas overlay; a new tile spawns only after the
 * pointer has moved >`size * 0.6` from the last drop, cycling through
 * `colors`. A `requestAnimationFrame` loop runs only while tiles are alive.
 * Honors `prefers-reduced-motion` (moves are no-ops).
 *
 * React port of ImageTrail.vue.
 */
export function DitherImageTrail({
  colors = ["#5227FF", "#7CFF67", "#3DA5FF", "#FF3D2E", "#FFD23D"],
  size = 40,
  duration = 650,
  className,
  children,
}: DitherImageTrailProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tilesRef = useRef<Tile[]>([]);
  const rafRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });
  const ciRef = useRef(0);

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
    const tiles = tilesRef.current.filter((t) => now - t.t0 < duration);
    tilesRef.current = tiles;
    for (const t of tiles) {
      const p = (now - t.t0) / duration;
      const s = size * (1 - p * 0.4);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = t.color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    rafRef.current = tiles.length ? requestAnimationFrame(frame) : 0;
  }

  function onMove(e: React.PointerEvent) {
    if (pixelPrefersReducedMotion()) return;
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const last = lastRef.current;
    if (Math.hypot(x - last.x, y - last.y) < size * 0.6) return;
    lastRef.current = { x, y };
    const palette = colors.length ? colors : ["#7CFF67"];
    tilesRef.current.push({
      x,
      y,
      t0: performance.now(),
      color: palette[ciRef.current % palette.length],
      rot: (Math.random() - 0.5) * 0.6,
    });
    ciRef.current += 1;
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
  }, [size, duration, colors]);

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
