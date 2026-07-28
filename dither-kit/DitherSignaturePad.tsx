"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { rgb } from "./palette";
import { BAYER4, fillOf, type PixelColor } from "./pixel";
import { useCanvasVisibility } from "./use-visibility";

export interface DitherSignaturePadProps {
  /** Stroke colour — palette name, hue number, or hex. */
  color?: PixelColor;
  /** Brush radius in dither cells (≈ px / CELL). */
  size?: number;
  /** Surface height in px. */
  height?: number;
  /** Accessible label prefix. */
  label?: string;
  /** Fired on stroke end (PNG data URL) and on clear (`null`). */
  onChange?: (dataUrl: string | null) => void;
  className?: string;
}

// Backing resolution: 2 css px per dither cell, upscaled crisp via CSS.
const CELL = 2;

type Pt = { x: number; y: number };
type Stroke = { fill: string; radius: number; pts: Pt[] };

/**
 * Stamp one Bayer-dithered brush dot at fractional cell coord (cx, cy). Each
 * cell within the radius lights when its 4×4 BAYER4 threshold falls under a
 * radial density that thins toward the edge — so a stroke reads as scattered
 * pixels (the kit's texture), never a solid disc. Pure, framework-agnostic.
 */
function stampDither(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fill: string,
): void {
  const r = Math.max(1, Math.ceil(radius));
  const baseX = Math.round(cx);
  const baseY = Math.round(cy);
  const reach = radius + 0.5;
  ctx.fillStyle = fill;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = baseX + dx;
      const py = baseY + dy;
      if (px < 0 || py < 0) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      // Centre is dense (≈0.95), edge thins (≈0.35) — fewer lit cells at edges.
      const density = 0.35 + 0.6 * (1 - dist / reach);
      if (BAYER4[py & 3][px & 3] <= density) ctx.fillRect(px, py, 1, 1);
    }
  }
}

/** Stamp a dense chain of dithered dots between two points so a fast stroke
 *  stays continuous. Starts at i=1 — the previous point was already stamped. */
function strokeSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  fill: string,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(0.4, radius * 0.5);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    stampDither(ctx, x0 + dx * t, y0 + dy * t, radius, fill);
  }
}

/**
 * DitherSignaturePad — a signature / sketch surface whose strokes render as
 * Bayer-dithered pixel trails rather than smooth anti-aliased lines.
 *
 * Drawing lives on a low-res backing canvas (CELL css px per dither cell),
 * upscaled crisp via `image-rendering: pixelated` — the same chunky-pixel
 * contract as the avatars / chart fills. The stroke geometry is the source of
 * truth (a ref array), so a resize replays it verbatim and re-entering the
 * viewport re-paints via `useCanvasVisibility`; only the derived `empty` flag
 * is React state (it drives the clear button + aria-label). `onChange` emits a
 * PNG data URL on stroke end and `null` on clear.
 *
 * Accessibility: the canvas is `role="img"` with a state-aware `aria-label`
 * (it is a drawing surface, not a keyboard widget); the Clear button is the
 * keyboard-accessible control. Pointer capture keeps the stroke bound to the
 * surface; `touch-action: none` stops touch scroll from hijacking a draw.
 *
 * No `prefers-reduced-motion` branch: drawing is direct manipulation, not an
 * animation — there is nothing to reduce.
 */
export function DitherSignaturePad({
  color = "green",
  size = 2,
  height = 180,
  label = "Signature pad",
  onChange,
  className,
}: DitherSignaturePadProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  const fill = useMemo(() => rgb(fillOf(color)), [color]);

  // Replay every stroke from the source-of-truth geometry. Stable (reads only
  // refs), so it can be the wake callback for the visibility observer.
  function redraw(): void {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) {
      if (s.pts.length === 0) continue;
      stampDither(ctx, s.pts[0].x, s.pts[0].y, s.radius, s.fill);
      for (let i = 1; i < s.pts.length; i++) {
        strokeSegment(ctx, s.pts[i - 1].x, s.pts[i - 1].y, s.pts[i].x, s.pts[i].y, s.radius, s.fill);
      }
    }
  }

  // Canvas lifecycle: acquire context, size the backing buffer, observe
  // resize, re-paint on viewport re-entry. All torn down on unmount.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    function resize(): void {
      const rect = wrap!.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width / CELL));
      const h = Math.max(1, Math.floor(rect.height / CELL));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        redraw();
      }
    }
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useCanvasVisibility(wrapRef, redraw);

  function toCell(e: React.PointerEvent<HTMLCanvasElement>): Pt | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / CELL, y: (e.clientY - rect.top) / CELL };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = toCell(e);
    const ctx = ctxRef.current;
    if (!p || !ctx) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const stroke: Stroke = { fill, radius: size, pts: [p] };
    strokesRef.current.push(stroke);
    stampDither(ctx, p.x, p.y, size, fill);
    setEmpty(false);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    const p = toCell(e);
    const ctx = ctxRef.current;
    if (!p || !ctx) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!stroke) return;
    const last = stroke.pts[stroke.pts.length - 1];
    strokeSegment(ctx, last.x, last.y, p.x, p.y, size, fill);
    stroke.pts.push(p);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    const canvas = canvasRef.current;
    onChange?.(canvas ? canvas.toDataURL("image/png") : null);
  }

  function clear(): void {
    strokesRef.current = [];
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(null);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-background/60",
        className,
      )}
      style={{ height }}
    >
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${label}${empty ? "" : " — contains a signature"}`}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <button
        type="button"
        disabled={empty}
        onClick={clear}
        aria-label="Clear signature"
        className={cn(
          CONTROL_BUTTON,
          "absolute right-2 top-2 rounded-md border border-border/70 bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        clear
      </button>
    </div>
  );
}
