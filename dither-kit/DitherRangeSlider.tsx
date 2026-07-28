"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { BAYER4, clamp01, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb, type Rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;

/** Paint the range track: the span between the two thumbs reads as a dense
 *  ordered-dither ramp (left→right) in the fill colour, the rails outside read
 *  as a sparse muted wash. Tick columns mark each integer step when few enough.
 *  Same Bayer recipe as DitherSlider's `paintTrack`. */
function paintRangeTrack(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  fill: Rgb,
  muted: Rgb,
  lo: number,
  hi: number,
  ticks: number[],
  matrix: number[][],
): void {
  ctx.clearRect(0, 0, cols, rows);
  const a = Math.round(cols * clamp01(lo));
  const b = Math.round(cols * clamp01(hi));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x >= a && x < b) {
        const t = (x - a + 0.5) / Math.max(1, b - a);
        const density = 0.4 + 0.6 * t;
        const lit = density > matrix[y & 3][x & 3];
        const k = 0.3 + density * 0.7;
        ctx.fillStyle = rgb(fill, 1, clamp01(lit ? k : k * 0.4));
      } else {
        const lit = 0.25 > matrix[y & 3][x & 3];
        ctx.fillStyle = rgb(muted, 1, lit ? 0.2 : 0.06);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (const t of ticks) {
    const x = Math.min(cols - 1, Math.round(cols * t));
    const inFill = x >= a && x < b;
    ctx.fillStyle = rgb(muted, 2, inFill ? 0.9 : 0.45);
    ctx.fillRect(x, 0, 1, rows);
  }
}

export interface DitherRangeSliderProps {
  /** Inclusive `[minimum, maximum]` selection. Parent-owned (controlled). */
  value: [number, number];
  /** Accessible group label. */
  label?: string;
  /** Numeric range bounds. */
  min?: number;
  max?: number;
  /** Step granularity for keyboard + drag snapping. */
  step?: number;
  /** Number format for `aria-valuetext` and the value bubble. */
  format?: (value: number) => string;
  /** Show a value bubble above the dragged/focused thumb. */
  showValues?: boolean;
  disabled?: boolean;
  color?: PixelColor;
  seed?: number;
  className?: string;
  onChange?: (value: [number, number]) => void;
}

/**
 * DitherRangeSlider — a dual-thumb minimum/maximum selector on a dithered
 * track. The selected span between the thumbs reads as a dense ordered-dither
 * ramp in the fill colour; the rails outside read as a sparse muted wash.
 *
 * Controlled via `value`/`onChange` as a `[min, max]` pair. The two thumbs may
 * meet but never cross. Pointer drag uses `setPointerCapture` so a press that
 * starts on a thumb keeps tracking it even when the cursor strays.
 *
 * Accessibility: `role="group"` wrapping two `role="slider"` thumbs with full
 * `aria-valuenow`/`valuemin`/`valuemax`/`valuetext`. Each thumb is keyboard
 * operable — Arrows nudge by `step`, Shift+Arrows by ten steps, Home/End jump
 * to the bound — and Tab moves between the two thumbs (each is tabbable; the
 * dragged one takes focus). Reduced motion: the value bubble is static.
 */
export function DitherRangeSlider({
  value,
  label,
  min = 0,
  max = 100,
  step = 1,
  format,
  showValues = false,
  disabled = false,
  color: colorProp,
  seed,
  className,
  onChange,
}: DitherRangeSliderProps) {
  const s = useMemo(() => (seed !== undefined ? kitFromSeed(seed) : null), [seed]);
  const color = useMemo<PixelColor>(() => colorProp ?? s?.hue ?? "blue", [colorProp, s]);
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const [lo, hi] = value;
  const span = Math.max(1e-9, max - min);
  const toRatio = (v: number) => clamp01((v - min) / span);
  const fmt = format ?? ((v: number) => String(v));

  // `active`/`focused` drive the value bubbles; both re-render, so useState.
  const [active, setActive] = useState<-1 | 0 | 1>(-1);
  const [focused, setFocused] = useState<-1 | 0 | 1>(-1);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Which thumb a pointer drag owns; read inside move/up handlers (no re-render
  // per move — the parent re-renders on `onChange`, which is the value source).
  const dragRef = useRef<0 | 1>(1);

  const tickRatios = useMemo(() => {
    const steps = span / step;
    const count = steps <= 25 ? Math.round(steps) : 10;
    return Array.from({ length: count + 1 }, (_, i) => i / count);
  }, [span, step]);

  const clampStep = useCallback(
    (raw: number) => {
      const stepped = min + Math.round((raw - min) / step) * step;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step],
  );

  const setThumb = useCallback(
    (which: 0 | 1, raw: number) => {
      const clamped = clampStep(raw);
      if (which === 0) onChange?.([Math.min(clamped, hi), hi]);
      else onChange?.([lo, Math.max(clamped, lo)]);
    },
    [onChange, clampStep, lo, hi],
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return min;
      const t = clamp01((clientX - rect.left) / Math.max(1, rect.width));
      return min + t * span;
    },
    [min, span],
  );

  const nearestThumb = useCallback(
    (v: number): 0 | 1 => (Math.abs(v - lo) <= Math.abs(v - hi) ? 0 : 1),
    [lo, hi],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      rootRef.current?.setPointerCapture(event.pointerId);
      const v = valueFromClientX(event.clientX);
      const which = nearestThumb(v);
      dragRef.current = which;
      setActive(which);
      setFocused(which);
      setThumb(which, v);
    },
    [disabled, valueFromClientX, nearestThumb, setThumb],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || active === -1) return;
      if (!rootRef.current?.hasPointerCapture(event.pointerId)) return;
      setThumb(dragRef.current, valueFromClientX(event.clientX));
    },
    [disabled, active, setThumb, valueFromClientX],
  );

  const onPointerUp = useCallback(() => setActive(-1), []);

  const onThumbKeydown = useCallback(
    (which: 0 | 1, event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const current = which === 0 ? lo : hi;
      const big = step * 10;
      let next: number | null = null;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - step;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + step;
      else if (event.key === "PageDown") next = current - big;
      else if (event.key === "PageUp") next = current + big;
      else if (event.key === "Home") next = which === 0 ? min : lo;
      else if (event.key === "End") next = which === 1 ? max : hi;
      if (next === null) return;
      event.preventDefault();
      setThumb(which, next);
    },
    [disabled, lo, hi, min, max, step, setThumb],
  );

  // Paint + resize lifecycle (RAF-deferred initial paint, single RO).
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!root || !canvas || !ctx) return;
      const box = root.getBoundingClientRect();
      const cols = Math.max(4, Math.round(box.width / CELL));
      const rows = 3;
      canvas.width = cols;
      canvas.height = rows;
      paintRangeTrack(
        ctx,
        cols,
        rows,
        fillOf(color),
        fillOf("grey"),
        toRatio(lo),
        toRatio(hi),
        tickRatios,
        matrix,
      );
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && rootRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(rootRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [value, lo, hi, min, max, color, matrix, tickRatios, toRatio]);

  const thumbs = [
    { which: 0 as const, v: lo, lo: min, hi, name: label ? `${label} minimum` : "Minimum" },
    { which: 1 as const, v: hi, lo, hi: max, name: label ? `${label} maximum` : "Maximum" },
  ];

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={cn(
        "relative h-4 w-full touch-none select-none",
        disabled ? "pointer-events-none opacity-40" : "cursor-pointer",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-[2px]">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      {thumbs.map((t) => (
        <div key={t.which}>
          <div
            role="slider"
            aria-label={t.name}
            aria-valuemin={t.lo}
            aria-valuemax={t.hi}
            aria-valuenow={t.v}
            aria-valuetext={fmt(t.v)}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ left: `${toRatio(t.v) * 100}%` }}
            onKeyDown={(e) => onThumbKeydown(t.which, e)}
            onFocus={() => setFocused(t.which)}
            onBlur={() => setFocused((f) => (f === t.which ? -1 : f))}
          />
          {showValues && (active === t.which || focused === t.which) ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] tabular-nums text-foreground"
              style={{ left: `${toRatio(t.v) * 100}%` }}
            >
              {fmt(t.v)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
