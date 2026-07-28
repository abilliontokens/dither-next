"use client";

import { useEffect, useRef } from "react";
import { useCanvasVisibility } from "./use-visibility";
import { cn } from "./lib";
import {
  BAYER4,
  clamp01,
  fillOf,
  pixelMatrixFromSeed,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb, type Rgb } from "./palette";

const CELL = 2;
/** Indeterminate comet arc length (radians). */
const ARC_LEN = 1.4;
const TAU = Math.PI * 2;

/**
 * Paint the ring annulus. Each cell inside `[inner, outer]` from the centre is
 * shaded by an ordered-dither ramp along the *filled* arc, so progress reads
 * as dense Bayer pixels sweeping clockwise from 12 o'clock; the unfilled track
 * carries a faint base wash so the ring is always visible. Indeterminate mode
 * paints a short comet arc starting at `a0` instead, with the same ramp.
 */
function paintRing(
  ctx: CanvasRenderingContext2D,
  cols: number,
  outer: number,
  inner: number,
  fill: Rgb,
  ratio: number,
  a0: number,
  indeterminate: boolean,
  matrix: number[][],
): void {
  ctx.clearRect(0, 0, cols, cols);
  const cx = (cols - 1) / 2;
  const cy = (cols - 1) / 2;
  const fillEnd = ratio * TAU;
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < inner || dist > outer) continue;
      // Angle clockwise from 12 o'clock, in [0, TAU).
      let a = Math.atan2(dx, -dy);
      if (a < 0) a += TAU;
      let density = 0;
      if (indeterminate) {
        const p = (a - a0 + TAU) % TAU;
        if (p < ARC_LEN) density = 0.35 + 0.65 * (p / ARC_LEN);
      } else if (a < fillEnd) {
        density = 0.35 + 0.65 * (fillEnd > 0 ? a / fillEnd : 0);
      }
      if (density > 0) {
        const lit = density > matrix[y & 3][x & 3];
        const k = 0.3 + density * 0.7;
        ctx.fillStyle = rgb(fill, 1, clamp01(lit ? k : k * 0.4));
      } else {
        // Faint base track so the whole ring is always legible.
        const lit = 0.22 > matrix[y & 3][x & 3];
        ctx.fillStyle = rgb(fill, 1, lit ? 0.16 : 0.05);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export interface DitherProgressRingProps {
  /** 0–100. Omit (or set `indeterminate`) for a spinning comet. */
  value?: number;
  indeterminate?: boolean;
  /** Square edge length in CSS px. */
  size?: number;
  /** Ring stroke thickness in CSS px. */
  thickness?: number;
  color?: PixelColor;
  /** Accessible name (also the center caption source when determinate). */
  label?: string;
  /** Render the percentage in the centre when determinate. */
  showValue?: boolean;
  seed?: number;
  className?: string;
}

/**
 * DitherProgressRing — a circular progress indicator on a `<canvas>` whose
 * filled arc is an ordered-dither Bayer ramp (dense pixels sweeping clockwise
 * from 12 o'clock), and whose indeterminate mode spins a short comet arc
 * around the ring.
 *
 * Accessibility: `role="progressbar"` with `aria-valuemin`/`valuemax`/`valuenow`
 * (omitted in indeterminate mode per the spec) and `aria-label`. The
 * indeterminate spin is a `requestAnimationFrame` loop that pauses while the
 * ring is scrolled off-screen (visibility gate via `useCanvasVisibility`,
 * resuming the same closure on re-entry) and stops entirely under
 * `prefers-reduced-motion` (a static comet replaces the spin).
 *
 * The ring is painted at the kit's CELL resolution and scaled up with
 * `imageRendering: pixelated` — deliberately low-res, matching every canvas in
 * the kit, so devicePixelRatio is intentionally not applied.
 */
export function DitherProgressRing({
  value = 0,
  indeterminate = false,
  size = 48,
  thickness = 6,
  color: colorProp,
  label,
  showValue = false,
  seed,
  className,
}: DitherProgressRingProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  // Mutable values the RAF loop reads each frame — refs so the closure stays
  // stable and reads fresh values without per-frame re-renders.
  const indeterminateRef = useRef(indeterminate);
  indeterminateRef.current = indeterminate;
  const valueRef = useRef(value);
  valueRef.current = value;
  const colorRef = useRef(color);
  colorRef.current = color;
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const reduceRef = useRef(false);

  const cols = Math.max(8, Math.round(size / CELL));
  const outer = (cols - 1) / 2;
  const thickCells = Math.max(1, Math.round(thickness / CELL));
  const inner = Math.max(0, outer - thickCells);

  function paint(a0: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;
    paintRing(
      ctx,
      cols,
      outer,
      inner,
      fillOf(colorRef.current),
      clamp01(valueRef.current / 100),
      a0,
      indeterminateRef.current,
      matrixRef.current,
    );
  }

  function repaint(): void {
    // Static frame whenever the spin loop isn't running: a determinate fill,
    // or a reduced-motion comet parked at 12 o'clock.
    paint(0);
  }

  function tick(): void {
    // Pause the spin while off-screen; onWake (useCanvasVisibility) resumes it.
    if (!isVisible()) {
      rafRef.current = 0;
      return;
    }
    const a0 = ((performance.now() / 16) % 360) * (TAU / 360);
    paint(a0);
    rafRef.current = requestAnimationFrame(tick);
  }

  function syncLoop(): void {
    const animate = indeterminateRef.current && !reduceRef.current;
    if (animate && !rafRef.current) rafRef.current = requestAnimationFrame(tick);
    if (!animate && rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (!rafRef.current) repaint();
  }

  const isVisible = useCanvasVisibility(canvasRef, () => syncLoop());

  useEffect(() => {
    reduceRef.current = pixelPrefersReducedMotion();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = cols;
      canvas.height = cols;
    }
    syncLoop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // Re-run when any paint input changes.
  }, [value, indeterminate, color, seed, size, thickness, cols, outer, inner]);

  const determined = !indeterminate;
  const pct = Math.round(clamp01(value / 100) * 100);

  return (
    <span
      ref={rootRef}
      role="progressbar"
      aria-label={label ?? (determined ? "Progress" : "Loading")}
      aria-valuemin={determined ? 0 : undefined}
      aria-valuemax={determined ? 100 : undefined}
      aria-valuenow={determined ? value : undefined}
      aria-valuetext={determined ? `${pct} percent` : undefined}
      className={cn("relative inline-flex items-center justify-center align-middle", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ width: `${size}px`, height: `${size}px`, imageRendering: "pixelated" }}
      />
      {determined && showValue ? (
        <span className="relative z-10 font-mono text-[10px] tabular-nums text-foreground">
          {pct}
        </span>
      ) : null}
    </span>
  );
}
