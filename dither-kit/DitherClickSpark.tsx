"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherClickSparkProps {
  color?: string;
  count?: number;
  size?: number;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

type Spark = { x: number; y: number; t0: number };

/**
 * DitherClickSpark — on click, emits a radial burst of `count` line sparks
 * that expand outward and fade over `duration` ms, drawn on a canvas overlay.
 * A `requestAnimationFrame` loop runs only while sparks are alive. Honors
 * `prefers-reduced-motion` (clicks are no-ops).
 *
 * React port of ClickSpark.vue.
 */
export function DitherClickSpark({
  color = "#7CFF67",
  count = 8,
  size = 16,
  duration = 420,
  className,
  children,
}: DitherClickSparkProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mutable animation state held in refs so the RAF closure reads fresh values
  // without re-subscribing on every prop change.
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef(0);

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
    const sparks = sparksRef.current.filter((s) => now - s.t0 < duration);
    sparksRef.current = sparks;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const s of sparks) {
      const p = (now - s.t0) / duration;
      const r0 = size * p;
      const len = size * (1 - p) * 0.7;
      ctx.globalAlpha = 1 - p;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x0 = s.x + Math.cos(a) * r0;
        const y0 = s.y + Math.sin(a) * r0;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    rafRef.current = sparks.length ? requestAnimationFrame(frame) : 0;
  }

  function onClick(e: React.MouseEvent) {
    if (pixelPrefersReducedMotion()) return;
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    sparksRef.current.push({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      t0: performance.now(),
    });
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
    <div ref={wrapRef} className={cn("relative", className)} onClick={onClick}>
      {children}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
}
