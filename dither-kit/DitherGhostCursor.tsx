"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherGhostCursorProps {
  color?: string;
  count?: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherGhostCursor — a trailing comet of fading circles follows the pointer.
 * Each frame the head eases halfway toward the cursor and is unshifted onto a
 * point list (capped at `count`); older points shrink and fade. Drawn on a
 * canvas overlay via a continuous `requestAnimationFrame` loop. Honors
 * `prefers-reduced-motion` (no loop).
 *
 * React port of GhostCursor.vue.
 */
export function DitherGhostCursor({
  color = "#7CFF67",
  count = 18,
  size = 10,
  className,
  children,
}: DitherGhostCursorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const ptsRef = useRef<{ x: number; y: number }[]>([]);
  const mRef = useRef({ x: 0, y: 0, active: false });

  function resize() {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    c.width = Math.max(1, r.width);
    c.height = Math.max(1, r.height);
  }

  function onMove(e: React.PointerEvent) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    mRef.current.x = e.clientX - r.left;
    mRef.current.y = e.clientY - r.top;
    mRef.current.active = true;
  }

  function onLeave() {
    mRef.current.active = false;
  }

  function frame() {
    rafRef.current = requestAnimationFrame(frame);
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const m = mRef.current;
    const pts = ptsRef.current;
    const head = pts[0] || { x: m.x, y: m.y };
    pts.unshift({ x: head.x + (m.x - head.x) * 0.5, y: head.y + (m.y - head.y) * 0.5 });
    if (pts.length > count) pts.pop();
    ctx.clearRect(0, 0, c.width, c.height);
    if (!m.active) return;
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length; i++) {
      const a = 1 - i / pts.length;
      ctx.globalAlpha = a * 0.8;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (!pixelPrefersReducedMotion()) rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [count, size, color]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
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
