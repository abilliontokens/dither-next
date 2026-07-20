"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";

export interface DitherMagnetLinesProps {
  color?: string;
  gap?: number;
  lineLength?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherMagnetLines — a grid of short line segments that each rotate to point
 * toward the pointer (like iron filings). Redrawn on each `pointermove` and on
 * resize; no RAF (static between moves). Defaults to pointing at the center
 * until the first move.
 *
 * React port of MagnetLines.vue.
 */
export function DitherMagnetLines({
  color = "#7CFF67",
  gap = 28,
  lineLength = 14,
  className,
  children,
}: DitherMagnetLinesProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ W: 1, H: 1 });
  // Pointer in canvas pixels; initialized to center on first resize.
  const mRef = useRef({ x: 0.5, y: 0.5 });

  function draw() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { W, H } = sizeRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const half = lineLength / 2;
    const m = mRef.current;
    for (let y = gap / 2; y < H; y += gap) {
      for (let x = gap / 2; x < W; x += gap) {
        const a = Math.atan2(m.y - y, m.x - x);
        const dx = Math.cos(a) * half;
        const dy = Math.sin(a) * half;
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
      }
    }
  }

  function resize() {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    const W = (c.width = Math.max(1, r.width));
    const H = (c.height = Math.max(1, r.height));
    sizeRef.current = { W, H };
    // On the first resize (m still the sentinel 0.5), center the pointer.
    if (mRef.current.x <= 1) {
      mRef.current = { x: W / 2, y: H / 2 };
    }
    draw();
  }

  function onMove(e: React.PointerEvent) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    mRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    draw();
  }

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [color, gap, lineLength]);

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
