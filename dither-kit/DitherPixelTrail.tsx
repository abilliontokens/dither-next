"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherPixelTrailProps {
  color?: string;
  gap?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherPixelTrail — the pointer lights up grid cells (snapped to `gap`) that
 * fade out over ~650ms, drawn as small squares on a canvas overlay. A
 * `requestAnimationFrame` loop runs only while lit cells remain. Honors
 * `prefers-reduced-motion` (moves are no-ops).
 *
 * React port of PixelTrail.vue.
 */
export function DitherPixelTrail({
  color = "#7CFF67",
  gap = 24,
  className,
  children,
}: DitherPixelTrailProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const litRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef(0);
  const LIFE = 650;

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
    ctx.fillStyle = color;
    const s = gap * 0.7;
    const lit = litRef.current;
    for (const [k, t] of lit) {
      const age = now - t;
      if (age > LIFE) {
        lit.delete(k);
        continue;
      }
      const [cx, cy] = k.split(",").map(Number);
      ctx.globalAlpha = 1 - age / LIFE;
      ctx.fillRect(
        cx * gap + (gap - s) / 2,
        cy * gap + (gap - s) / 2,
        s,
        s,
      );
    }
    ctx.globalAlpha = 1;
    rafRef.current = lit.size ? requestAnimationFrame(frame) : 0;
  }

  function onMove(e: React.PointerEvent) {
    if (pixelPrefersReducedMotion()) return;
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const cx = Math.floor((e.clientX - r.left) / gap);
    const cy = Math.floor((e.clientY - r.top) / gap);
    litRef.current.set(`${cx},${cy}`, performance.now());
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
  }, [gap]);

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
