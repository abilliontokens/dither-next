"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;

/** Paint the active-segment indicator — a quiet rest-intensity Bayer wash in
 *  the fill colour with a brighter base row, the same recipe as DitherTabs'
 *  washed variant. It sits behind the selected radio and slides between
 *  positions. */
function paintSegmentWash(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  color: PixelColor,
  matrix: number[][],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || w <= 0 || h <= 0) return;
  const cols = Math.max(4, Math.round(w / CELL));
  const rows = Math.max(4, Math.round(h / CELL));
  canvas.width = cols;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, cols, rows);
  for (let y = 0; y < rows; y++) {
    const density = 0.25 + 0.5 * ((y + 0.5) / rows);
    for (let x = 0; x < cols; x++) {
      const lit = density > matrix[y & 3][x & 3];
      ctx.fillStyle = rgb(fill, 1, lit ? 0.34 : 0.09);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = rgb(fill, 1, 0.5);
  ctx.fillRect(0, rows - 1, cols, 1);
}

export type SegmentItem = { value: string; label: ReactNode; disabled?: boolean };

export interface DitherSegmentedProps {
  /** Plain strings or `{ value, label, disabled }` items. */
  segments: (string | SegmentItem)[];
  /** Parent-owned selected value. */
  value: string;
  onChange?: (value: string) => void;
  /** Accessible group label. */
  label?: string;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/**
 * DitherSegmented — an iOS-style segmented control: a row of mutually exclusive
 * options whose active one is marked by a sliding dithered indicator (a washed
 * Bayer fill in the kit's colour) that animates between positions.
 *
 * Controlled via `value`/`onChange`. Accessibility: `role="radiogroup"` with
 * one `role="radio"` per option, `aria-checked`, and roving tabindex. Arrow
 * keys walk the enabled options in either direction; Home/End jump to the
 * ends. Reduced motion: the indicator snaps instead of sliding ( honoured via
 * Tailwind's `motion-reduce:` variant on the position transition).
 *
 * The indicator is a canvas painted at the active segment's measured box and
 * repositioned on selection/resize (`requestAnimationFrame`-deferred measure,
 * single `ResizeObserver`, guide §9).
 */
export function DitherSegmented({
  segments,
  value,
  onChange,
  label,
  color: colorProp,
  seed,
  className,
}: DitherSegmentedProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color = useMemo<PixelColor>(() => colorProp ?? s?.hue ?? "blue", [colorProp, s]);
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const items = useMemo(
    () => segments.map((seg) => (typeof seg === "string" ? { value: seg, label: seg } : seg)),
    [segments],
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Latest inputs for the mount-once measure/RO closure.
  const valueRef = useRef(value);
  valueRef.current = value;
  const colorRef = useRef(color);
  colorRef.current = color;
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const measure = useCallback(() => {
    const cur = itemsRef.current;
    const i = cur.findIndex((t) => t.value === valueRef.current);
    const btn = btnRefs.current[i];
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;
    setBox({ left: btn.offsetLeft, top: btn.offsetTop, width: btn.offsetWidth, height: btn.offsetHeight });
    paintSegmentWash(canvas, btn.offsetWidth, btn.offsetHeight, colorRef.current, matrixRef.current);
  }, []);

  const select = useCallback(
    (v: string) => {
      onChange?.(v);
    },
    [onChange],
  );

  const focusOption = useCallback((v: string) => {
    const i = itemsRef.current.findIndex((t) => t.value === v);
    if (i >= 0) queueMicrotask(() => btnRefs.current[i]?.focus());
  }, []);

  const onKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const cur = itemsRef.current;
      const enabled = cur.map((t, i) => ({ t, i })).filter(({ t }) => !t.disabled);
      const pos = enabled.findIndex(({ t }) => t.value === valueRef.current);
      let next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (pos + 1) % enabled.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (pos - 1 + enabled.length) % enabled.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = enabled.length - 1;
      else return;
      e.preventDefault();
      const target = enabled[next];
      select(target.t.value);
      focusOption(target.t.value);
    },
    [select, focusOption],
  );

  // Mount-once: initial measure (RAF-deferred) + ResizeObserver.
  useEffect(() => {
    const root = rootRef.current;
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      measure();
      if (typeof ResizeObserver !== "undefined" && root) {
        ro = new ResizeObserver(measure);
        ro.observe(root);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [measure]);

  // Re-measure + repaint when selection/items/colour move.
  useEffect(() => {
    measure();
  }, [value, segments, color, matrix, measure]);


  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={label}
      className={cn("relative inline-flex items-center gap-0.5 rounded-md border border-border/60 p-0.5 font-mono text-[12px]", className)}
      onKeyDown={onKeydown}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute rounded transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none"
        style={{
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          imageRendering: "pixelated",
        }}
      />
      {items.map((t, i) => {
        const checked = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={t.disabled}
            onClick={() => select(t.value)}
            className={cn(
              "relative z-10 rounded px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-40",
              checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
