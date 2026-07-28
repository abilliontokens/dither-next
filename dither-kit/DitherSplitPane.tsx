"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
const HANDLE_CSS = 6; // handle thickness on the split axis (css px)

/** Paint the gripper pad — a radial Bayer cluster, dense at the centre and
 *  sparse toward the edges, so the drag handle reads as a pixel grip. `boost`
 *  (1 at rest, ~1.35 while dragging/focused) brightens the whole pad without
 *  changing the threshold pattern. Same single-colour-modulated-by-alpha rule
 *  as every kit painter. */
function paintGrip(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
  boost: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const css = canvas.offsetWidth;
  if (!ctx || css <= 0) return;
  const n = Math.max(4, Math.round(css / CELL));
  canvas.width = n;
  canvas.height = n;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, n, n);
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxD; // 0 centre → 1 corner
      const density = Math.max(0, 1 - d * 1.6);
      if (density <= 0) continue;
      const lit = density > matrix[y & 3][x & 3];
      const k = (lit ? 0.32 + 0.6 * density : 0.1 * density) * boost;
      if (k <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, Math.min(1, k));
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export interface DitherSplitPaneProps {
  /** Axis the panes split along. */
  orientation?: "horizontal" | "vertical";
  /** First pane's fraction (0..1). Omit for uncontrolled (`defaultRatio`). */
  ratio?: number;
  /** Uncontrolled initial ratio. */
  defaultRatio?: number;
  onRatioChange?: (ratio: number) => void;
  /** Minimum first-pane size, percent. */
  min?: number;
  /** Maximum first-pane size, percent. */
  max?: number;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Exactly two panes. */
  children: ReactNode;
}

/**
 * DitherSplitPane — a two-pane resizable split. The drag handle is a dithered
 * gripper pad (radial Bayer cluster) that brightens while active.
 *
 * Controlled when `ratio` is provided; otherwise `defaultRatio` seeds
 * uncontrolled internal state and `onRatioChange` still fires. The handle is a
 * `role="separator"` with `aria-orientation`/`aria-valuenow/min/max` (percent).
 * Keyboard: Arrow keys nudge ±1%, PageUp/PageDown jump ±10%, Enter and Home
 * both reset to the default ratio. Pointer drag uses `setPointerCapture` and is
 * clamped to `min`/`max`. SSR-safe: ids from `useId()`, all canvas/DOM in
 * effects; `prefers-reduced-motion` is left to the pane content (the handle
 * itself has no animation).
 */
export function DitherSplitPane({
  orientation = "horizontal",
  ratio: ratioProp,
  defaultRatio = 0.5,
  onRatioChange,
  min = 10,
  max = 90,
  color: colorProp,
  seed,
  className,
  children,
}: DitherSplitPaneProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const horizontal = orientation === "horizontal";
  const minR = Math.min(1, Math.max(0, min / 100));
  const maxR = Math.min(1, Math.max(minR, max / 100));

  const rootRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLCanvasElement | null>(null);

  // Controlled-vs-uncontrolled: render always reads `current`, which is either
  // the parent's prop or internal state — never a bare ref.
  const [internal, setInternal] = useState(
    Math.min(maxR, Math.max(minR, defaultRatio)),
  );
  const current = ratioProp !== undefined ? ratioProp : internal;

  const [active, setActive] = useState(false);
  // Mirror `current` into a ref so the pointer-move handler (captured once per
  // drag) reads the freshest ratio without rebuilding — but render reads state.
  const currentRef = useRef(current);
  currentRef.current = current;

  const reactId = useId();
  const separatorId = `dk-split-${reactId.replace(/:/g, "")}`;

  const clampRatio = useCallback(
    (r: number) => Math.min(maxR, Math.max(minR, r)),
    [minR, maxR],
  );

  const commit = useCallback(
    (next: number) => {
      const clamped = clampRatio(next);
      if (ratioProp === undefined) setInternal(clamped);
      onRatioChange?.(clamped);
    },
    [clampRatio, onRatioChange, ratioProp],
  );

  const ratioFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return currentRef.current;
      if (horizontal) {
        const usable = Math.max(1, rect.width - HANDLE_CSS);
        return (clientX - rect.left - HANDLE_CSS / 2) / usable;
      }
      const usable = Math.max(1, rect.height - HANDLE_CSS);
      return (clientY - rect.top - HANDLE_CSS / 2) / usable;
    },
    [horizontal],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setActive(true);
      commit(ratioFromPointer(e.clientX, e.clientY));
    },
    [commit, ratioFromPointer],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      commit(ratioFromPointer(e.clientX, e.clientY));
    },
    [commit, ratioFromPointer],
  );

  const endDrag = useCallback(() => setActive(false), []);

  const onKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const small = 0.01;
      const big = 0.1;
      let next: number | null = null;
      // Horizontal: Right grows pane A / Left shrinks. Vertical: Up / Down.
      const grow = horizontal ? "ArrowRight" : "ArrowUp";
      const shrink = horizontal ? "ArrowLeft" : "ArrowDown";
      switch (e.key) {
        case grow: next = currentRef.current + small; break;
        case shrink: next = currentRef.current - small; break;
        case "PageUp": next = currentRef.current + big; break;
        case "PageDown": next = currentRef.current - big; break;
        case "Home":
        case "Enter": next = defaultRatio; break;
        case "End": next = maxR; break;
      }
      if (next === null) return;
      e.preventDefault();
      commit(next);
    },
    [commit, defaultRatio, horizontal, maxR],
  );

  // Paint gripper after mount, on colour/active/size change, and on resize.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      if (gripRef.current) paintGrip(gripRef.current, color, matrix, active ? 1.35 : 1);
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && gripRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(gripRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [color, matrix, active]);

  const panes = Array.isArray(children)
    ? (children as ReactNode[]).slice(0, 2)
    : [children];

  const now = Math.round(current * 100);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex min-h-0 min-w-0 overflow-hidden",
        horizontal ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div
        className="min-h-0 min-w-0 overflow-auto"
        style={horizontal ? { width: `${current * 100}%` } : { height: `${current * 100}%` }}
      >
        {panes[0]}
      </div>

      <div
        id={separatorId}
        role="separator"
        tabIndex={0}
        aria-orientation={orientation}
        aria-valuenow={now}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={`Resize panes, ${now} percent`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeydown}
        className={cn(
          "group relative flex shrink-0 items-center justify-center bg-border/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
          horizontal ? "w-[6px] cursor-col-resize" : "h-[6px] cursor-row-resize",
        )}
      >
        <canvas
          ref={gripRef}
          aria-hidden="true"
          className={cn(
            "transition-opacity",
            horizontal ? "h-4 w-4" : "h-4 w-4",
            active ? "opacity-100" : "opacity-80",
          )}
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        {panes[1]}
      </div>
    </div>
  );
}
