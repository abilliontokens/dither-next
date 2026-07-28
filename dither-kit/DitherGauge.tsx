"use client";

import { useCallback, useEffect, useId, useRef } from "react";

import {
  BAYER4,
  fillOf,
  pixelPrefersReducedMotion,
  pixelMatrixFromSeed,
  type PixelColor,
} from "./pixel";
import { kitFromSeed, easeInOutCubic } from "./dither-paint";
import { rgb, type Rgb } from "./palette";
import { useCanvasVisibility } from "./use-visibility";
import { cn } from "./lib";

const CELL = 2;
const SWEEP = Math.PI * 1.5; // 270° arc (opens at the bottom)
const START = Math.PI * 0.75; // lower-left

export type DitherGaugeSegment = {
  /** Zone start as a 0..1 fraction of the range. */
  from: number;
  /** Zone end as a 0..1 fraction. */
  to: number;
  /** Zone colour (defaults to the gauge colour). */
  color?: PixelColor;
};

/** Paint the arc as a Bayer-thresholded ramp. Each backing pixel inside the
 *  [innerR, outerR] band and within the sweep gets a density: the filled span
 *  (0..value) ramps from sparse to dense toward the needle; the track beyond is
 *  a faint scatter. Zone segments recolour both spans in place. Same single-
 *  colour-modulated-by-alpha rule as every kit painter. */
function paintGauge(
  ctx: CanvasRenderingContext2D,
  n: number,
  innerR: number,
  outerR: number,
  valueRatio: number,
  color: PixelColor,
  segments: DitherGaugeSegment[],
  matrix: number[][],
): void {
  ctx.clearRect(0, 0, n, n);
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const defaultFill = fillOf(color);
  for (let by = 0; by < n; by++) {
    for (let bx = 0; bx < n; bx++) {
      const dx = bx - cx;
      const dy = by - cy;
      const r = Math.hypot(dx, dy);
      if (r < innerR || r > outerR) continue;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI * 2;
      const t = (a - START + Math.PI * 2) % (Math.PI * 2);
      if (t > SWEEP) continue; // outside the arc (the bottom gap)
      const ratio = t / SWEEP;
      const seg = segments.find((s) => ratio >= s.from && ratio <= s.to);
      const col: Rgb = seg ? fillOf(seg.color ?? color) : defaultFill;
      const filled = ratio <= valueRatio;
      const density = filled ? 0.32 + 0.62 * ratio : 0.12;
      const lit = density > matrix[by & 3][bx & 3];
      const alpha = lit ? 0.42 + 0.5 * density : 0.1 * density;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(col, 1, alpha);
      ctx.fillRect(bx, by, 1, 1);
    }
  }
}

/** Draw the crisp needle + hub on a DPR-scaled overlay canvas. */
function paintNeedle(
  ctx: CanvasRenderingContext2D,
  cssSize: number,
  innerR: number,
  valueRatio: number,
): void {
  ctx.clearRect(0, 0, cssSize, cssSize);
  const cx = cssSize / 2;
  const cy = cssSize / 2;
  const angle = START + valueRatio * SWEEP;
  const nx = cx + Math.cos(angle) * (innerR - 1);
  const ny = cy + Math.sin(angle) * (innerR - 1);
  ctx.strokeStyle = "rgba(245,245,250,0.95)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.stroke();
  ctx.fillStyle = "rgba(245,245,250,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

export interface DitherGaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  color?: PixelColor;
  /** Square css px. */
  size?: number;
  /** Arc band thickness in css px. */
  thickness?: number;
  /** Zone bands recoloured across the arc. */
  segments?: DitherGaugeSegment[];
  seed?: number;
  className?: string;
}

/**
 * DitherGauge — a radial gauge. The arc is painted to a canvas with the kit's
 * ordered-dither ramp (filled span sparse→dense toward the needle, track a
 * faint scatter, optional zone `segments` recoloured in place); a crisp needle
 * + hub are drawn on a second DPR-scaled canvas stacked above — the two-canvas
 * crisp/bitmap idiom the chart pack uses.
 *
 * `role="meter"` with `aria-valuenow/min/max` and `aria-valuetext`. On value
 * change the needle sweeps via rAF with `easeInOutCubic`; under
 * `prefers-reduced-motion` it jumps instantly. The loop is visibility-gated
 * (`useCanvasVisibility`) so an off-screen gauge costs nothing, and it resumes
 * its same closure on re-entry. SSR-safe: all canvas/DPR work is in effects;
 * ids from `useId()`.
 */
export function DitherGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit = "",
  color: colorProp,
  size = 160,
  thickness = 14,
  segments = [],
  seed,
  className,
}: DitherGaugeProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const ratio = Math.min(1, Math.max(0, (value - min) / Math.max(1e-9, max - min)));

  const fillRef = useRef<HTMLCanvasElement | null>(null);
  const needleRef = useRef<HTMLCanvasElement | null>(null);
  const displayedRef = useRef(ratio);
  const targetRef = useRef(ratio);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const fromRef = useRef(ratio);
  const reduceRef = useRef(false);

  const reactId = useId();
  const meterId = `dk-gauge-${reactId.replace(/:/g, "")}`;

  const n = Math.max(16, Math.round(size / CELL));
  const outerR = (n - 1) / 2;
  const innerR = Math.max(2, outerR - Math.round(thickness / CELL));

  const paint = useCallback(() => {
    const fctx = fillRef.current?.getContext("2d", { willReadFrequently: true });
    if (fctx) paintGauge(fctx, n, innerR, outerR, displayedRef.current, color, segments, matrix);
    const nctx = needleRef.current?.getContext("2d");
    if (nctx) paintNeedle(nctx, size, innerR * CELL, displayedRef.current);
  }, [n, innerR, outerR, color, segments, matrix, size]);

  // Visibility gate — pause the sweep off-screen; resume the same closure.
  const visible = useCanvasVisibility(fillRef, () => {
    if (!rafRef.current && !reduceRef.current && displayedRef.current !== targetRef.current) {
      startTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  });

  const tick = useCallback(() => {
    rafRef.current = 0;
    if (!visible()) return; // off-screen: pause; onWake restarts
    const target = targetRef.current;
    const from = fromRef.current;
    if (startTimeRef.current === 0) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const dur = 420;
    const t = Math.min(1, elapsed / dur);
    displayedRef.current = from + (target - from) * easeInOutCubic(t);
    paint();
    if (t < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      displayedRef.current = target;
      paint();
    }
  }, [paint, visible]);

  // Mount: detect reduced motion, paint initial, observe resize.
  useEffect(() => {
    reduceRef.current = pixelPrefersReducedMotion();
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && fillRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(fillRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [paint]);

  // Value change → start/continue the sweep (or jump when reduced).
  useEffect(() => {
    targetRef.current = ratio;
    if (reduceRef.current) {
      displayedRef.current = ratio;
      paint();
      return;
    }
    fromRef.current = displayedRef.current;
    startTimeRef.current = 0;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [ratio, paint, tick]);

  // Set up the needle overlay's DPR backing once (size stable per mount).
  useEffect(() => {
    const canvas = needleRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }, [size, paint]);

  return (
    <div
      role="meter"
      id={meterId}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${value}${unit}`}
      aria-label={label}
      className={cn("relative inline-flex flex-col items-center font-mono text-foreground", className)}
      style={{ width: `${size}px` }}
    >
      <div className="relative" style={{ width: `${size}px`, height: `${size}px` }}>
        <canvas
          ref={fillRef}
          aria-hidden="true"
          className="absolute inset-0"
          style={{ width: `${size}px`, height: `${size}px`, imageRendering: "pixelated" }}
        />
        <canvas
          ref={needleRef}
          aria-hidden="true"
          className="absolute inset-0"
          style={{ width: `${size}px`, height: `${size}px` }}
        />
        {/* Crisp centre readout (DOM, not canvas) */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
          <span className="text-[22px] tabular-nums leading-none">
            {value}
            <span className="ml-0.5 text-[12px] text-muted-foreground">{unit}</span>
          </span>
          {label && <span className="mt-1 text-[10px] text-muted-foreground">{label}</span>}
        </div>
      </div>
    </div>
  );
}
