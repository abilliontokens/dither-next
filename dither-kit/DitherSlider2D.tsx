"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "./lib";
import { BAYER4, clamp01, fillOf, pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { rgb, type Rgb } from "./palette";

const CELL = 2;

/**
 * Paint the 2D pad as a Bayer-dithered density map that encodes the value: the
 * rectangle from the origin up to (value.x, value.y) reads as a dense wash of the
 * fill colour, the rest as a faint muted wash — the 2D analogue of a slider's
 * filled span. Both halves are Bayer-modulated (density, not flat fills), so the
 * whole surface carries the kit's texture and the thumb's quadrant is obvious.
 *
 * `fy` is flipped because value-space is "up = high" while canvas rows grow down.
 */
function paintPad(
  canvas: HTMLCanvasElement,
  val: { x: number; y: number },
  fill: Rgb,
): void {
  const ctx = canvas.getContext("2d");
  const root = canvas.parentElement;
  if (!ctx || !root) return;
  const box = root.getBoundingClientRect();
  const cols = Math.max(8, Math.round(box.width / CELL));
  const rows = Math.max(8, Math.round(box.height / CELL));
  if (canvas.width !== cols) canvas.width = cols;
  if (canvas.height !== rows) canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  const muted = fillOf("grey");
  for (let y = 0; y < rows; y++) {
    const fy = 1 - (y + 0.5) / rows; // value-space vertical (up = high)
    for (let x = 0; x < cols; x++) {
      const fx = (x + 0.5) / cols;
      const tx = BAYER4[y & 3][x & 3];
      let col: Rgb;
      let alpha: number;
      if (fx <= val.x && fy <= val.y) {
        col = fill;
        alpha = 0.78 > tx ? 0.85 : 0.3;
      } else {
        col = muted;
        alpha = 0.18 > tx ? 0.2 : 0.05;
      }
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(col, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export interface DitherSlider2DValue {
  /** Horizontal position, 0–1 (left→right). */
  x: number;
  /** Vertical position, 0–1 (bottom→top, "up = high"). */
  y: number;
}

export interface DitherSlider2DProps {
  value: DitherSlider2DValue;
  onChange?: (v: DitherSlider2DValue) => void;
  /** Pad width; number ⇒ px. */
  width?: number | string;
  /** Pad height; number ⇒ px. */
  height?: number | string;
  /** Accessible name for the pad. */
  label?: string;
  color?: PixelColor;
  disabled?: boolean;
  className?: string;
}

function sizeProp(v: number | string | undefined, fallback: number): string {
  if (v === undefined) return `${fallback}px`;
  return typeof v === "number" ? `${v}px` : v;
}

/**
 * DitherSlider2D — a 2D trackpad/XY pad. A draggable thumb sits on a surface
 * whose texture is a Bayer-dithered density map encoding the current `{x, y}`:
 * the origin-to-value quadrant is dense, the rest faint. Distinct from
 * `DitherSlider` (a 1D track) and `DitherColorPicker`'s SV field (which encodes
 * saturation/value, not an arbitrary point).
 *
 * Pointer: `setPointerCapture` drag maps client position to `{x, y}` in [0,1]².
 * Keyboard: the thumb is a single `role="slider"` (2D value conveyed via
 * `aria-valuetext="x: N%, y: M%"`); arrows nudge 1% (Shift = 10%), Home/End jump
 * to the corners. Reduced motion is honoured (no entrance to suppress here, but
 * the contract is read so the component stays consistent with its siblings).
 *
 * SSR-safe: the pad paints in an effect + on resize; `matchMedia` is read only in
 * an effect. `value` is a prop, so the thumb position is a stable literal on the
 * server and matches the first client render.
 */
export function DitherSlider2D({
  value,
  onChange,
  width,
  height,
  label = "2D slider",
  color = "blue",
  disabled = false,
  className,
}: DitherSlider2DProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef(false);

  const fill = useMemo<Rgb>(() => fillOf(color), [color]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);

  // Paint on mount, on value/colour change, and on resize.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      if (canvasRef.current) paintPad(canvasRef.current, value, fill);
      if (typeof ResizeObserver !== "undefined" && padRef.current) {
        ro = new ResizeObserver(() => {
          if (canvasRef.current) paintPad(canvasRef.current, value, fill);
        });
        ro.observe(padRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [value, fill]);

  function pointToValue(clientX: number, clientY: number): DitherSlider2DValue {
    const rect = padRef.current!.getBoundingClientRect();
    const x = clamp01((clientX - rect.left) / Math.max(1, rect.width));
    const y = 1 - clamp01((clientY - rect.top) / Math.max(1, rect.height));
    return { x, y };
  }
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    padRef.current?.setPointerCapture(e.pointerId);
    drag.current = true;
    onChange?.(pointToValue(e.clientX, e.clientY));
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled || !drag.current) return;
    if (!padRef.current?.hasPointerCapture(e.pointerId)) return;
    onChange?.(pointToValue(e.clientX, e.clientY));
  }
  function onPointerUp(): void {
    drag.current = false;
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    let { x, y } = value;
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === "ArrowRight") x = value.x + step;
    else if (e.key === "ArrowLeft") x = value.x - step;
    else if (e.key === "ArrowUp") y = value.y + step;
    else if (e.key === "ArrowDown") y = value.y - step;
    else if (e.key === "Home") {
      x = 0;
      y = 0;
    } else if (e.key === "End") {
      x = 1;
      y = 1;
    } else return;
    e.preventDefault();
    onChange?.({ x: clamp01(x), y: clamp01(y) });
  }

  const padStyle: CSSProperties = {
    width: sizeProp(width, 240),
    height: sizeProp(height, 160),
  };
  const xPct = Math.round(clamp01(value.x) * 100);
  const yPct = Math.round(clamp01(value.y) * 100);
  // Integer percentages only — a raw `value.x * 100` float here would reach the
  // SSR'd style attribute and re-serialise differently in the browser (the
  // hydration class of bug the kit rounds away via ./lib).
  const thumbStyle: CSSProperties = {
    left: `${xPct}%`,
    top: `${100 - yPct}%`,
    transition: reduced ? "none" : undefined,
  };

  return (
    <div
      ref={padRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={xPct}
      aria-valuetext={`x: ${xPct}%, y: ${yPct}%`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "relative touch-none select-none overflow-hidden rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        disabled ? "pointer-events-none opacity-40" : "cursor-crosshair",
        className,
      )}
      style={padStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKey}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-[1px] border-2 border-foreground bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={thumbStyle}
      />
    </div>
  );
}
