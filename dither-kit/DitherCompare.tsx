"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn, round } from "./lib";
import { BAYER4, clamp01, pixelPrefersReducedMotion } from "./pixel";

/** Width of the dissolve band in CSS px, straddling the divider. The seam is
 *  not a hard 1px line: across this band the "after" layer's alpha is driven by
 *  the `BAYER4` threshold versus a density ramp, so the boundary dissolves into
 *  a few columns of Bayer stipple — the kit's texture, not a feathered blur. */
const BAND = 14;

type Orientation = "vertical" | "horizontal";

export interface DitherCompareProps {
  /** The base layer — fully visible. Usually the "before" image/content. */
  before: React.ReactNode;
  /** The revealed layer — uncovered by dragging the divider toward 100. */
  after: React.ReactNode;
  /** Divider axis. `vertical` (default) slides left↔right; `horizontal` slides up↕down. */
  orientation?: Orientation;
  /** Controlled divider position, 0–100 (percent across the axis). */
  position?: number;
  /** Initial position when uncontrolled. */
  defaultPosition?: number;
  /** Fired with the new 0–100 position as the divider moves. */
  onPositionChange?: (position: number) => void;
  /** Accessible label for the comparison. */
  label?: string;
  className?: string;
}

/**
 * DitherCompare — before/after comparison slider.
 *
 * Two stacked layers: `before` is the always-visible base, `after` is uncovered
 * toward 100 by dragging the divider. The reveal boundary is **not** a hard
 * 1px clip — the `after` layer wears a Bayer-dithered alpha mask: across a
 * `BAND`-px strip straddling the divider the per-pixel alpha follows the
 * `BAYER4` threshold against a density ramp, so the seam dissolves into a few
 * columns of ordered stipple. The divider handle itself is a vertical strip
 * whose face is the same Bayer tile, so the handle and the seam share one
 * texture.
 *
 * **Hydration:** the divider position reaches the DOM as a percentage of a
 * controlled float, so it is `round`-ed before it hits any inline style
 * (percentages from a controlled position are the classic mismatch source).
 * Canvas pixels are never hydrated, so mask geometry is untouched.
 *
 * **State vs ref:** `position` is state (it drives the divider DOM + mask). The
 * mask ImageData buffer and the active-pointer bookkeeping are refs — they are
 * never read during render. `dragging` is state only because it toggles a
 * cursor/grabbing class on the handle.
 *
 * Accessibility: the handle is a `role="slider"` (0–100) with arrows (±1,
 * Shift = ±10), Home/End (0/100) and PageUp/PageDown (±10). A reduced-motion
 * branch drops the handle glow animation.
 */
export function DitherCompare({
  before,
  after,
  orientation = "vertical",
  position,
  defaultPosition = 50,
  onPositionChange,
  label = "Comparison slider",
  className,
}: DitherCompareProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskBufRef = useRef<ImageData | null>(null);
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const pointerIdRef = useRef<number | null>(null);

  const reactId = useId();
  const sliderHandleId = `${reactId}-handle`;

  const controlled = position !== undefined;
  const [internal, setInternal] = useState(defaultPosition);
  const pct = clamp01((controlled ? position : internal) / 100) * 100;

  const [dragging, setDragging] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);

  // The Bayer tile baked once for the divider face (client-only — canvas is
  // never touched during render, so SSR markup is stable with no tile).
  const [handleTile, setHandleTile] = useState("");
  useEffect(() => {
    if (typeof document === "undefined") return;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 4, 4);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (BAYER4[y][x] <= 0.55) ctx.fillRect(x, y, 1, 1);
      }
    }
    setHandleTile(c.toDataURL());
  }, []);

  function commit(next: number): void {
    const v = clamp01(next / 100) * 100;
    if (!controlled) setInternal(v);
    onPositionChange?.(round(v, 3));
  }

  // --- mask build (the dither dissolve) -------------------------------------
  function buildMask(w: number, h: number, pos: number): string {
    let canvas = maskCanvasRef.current;
    if (!canvas) {
      if (typeof document === "undefined") return "";
      canvas = document.createElement("canvas");
      maskCanvasRef.current = canvas;
    }
    if (w === 0 || h === 0) return "";
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    let img = maskBufRef.current;
    if (!img || img.width !== w || img.height !== h) {
      img = ctx.createImageData(w, h);
      maskBufRef.current = img;
    }
    const data = img.data;
    const axis = orientation === "vertical" ? w : h;
    const center = (pos / 100) * axis;
    const lo = center - BAND / 2;
    const hi = center + BAND / 2;
    // White = show the after layer, black = hide it. Inside [0, lo] fully show
    // (after revealed up to the divider), beyond `hi` fully hidden; in the
    // band, density falls off left→right and is gated by the Bayer threshold.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const along = orientation === "vertical" ? x : y;
        let a: number;
        if (along <= lo) a = 255;
        else if (along >= hi) a = 0;
        else {
          const t = (along - lo) / BAND; // 0 at lo → 1 at hi
          const density = 1 - t; // show more near the left edge of the band
          const tx = BAYER4[y & 3][x & 3];
          a = tx <= density ? 255 : 0;
        }
        const o = (y * w + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
        data[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  // Track container size and rebuild the mask when position/size/orientation
  // changes. rAF-coalesced so a flurry of pointermove events builds at most one
  // mask per frame.
  const [maskUrl, setMaskUrl] = useState("");
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    function measure(): { w: number; h: number } {
      const r = rootRef.current!.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      return { w, h };
    }
    function run(): void {
      const { w, h } = measure();
      dimsRef.current = { w, h };
      setMaskUrl(buildMask(w, h, pct));
    }
    raf = requestAnimationFrame(run);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(run);
      });
      ro.observe(root);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
    // `pct`, `orientation` are the real deps; buildMask reads refs for canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, orientation]);

  // --- pointer drag ---------------------------------------------------------
  function pointToPos(clientX: number, clientY: number): number {
    const r = rootRef.current!.getBoundingClientRect();
    const along =
      orientation === "vertical"
        ? clientX - r.left
        : clientY - r.top;
    return clamp01(along / Math.max(1, orientation === "vertical" ? r.width : r.height)) * 100;
  }
  function onHandlePointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    setDragging(true);
  }
  function onHandlePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (pointerIdRef.current !== e.pointerId) return;
    commit(pointToPos(e.clientX, e.clientY));
  }
  function onHandlePointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    pointerIdRef.current = null;
    setDragging(false);
  }
  function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.target !== e.currentTarget) return; // handle owns its own drag
    commit(pointToPos(e.clientX, e.clientY));
  }

  // --- keyboard -------------------------------------------------------------
  function onHandleKeydown(e: ReactKeyboardEvent<HTMLButtonElement>): void {
    const big = e.shiftKey ? 10 : 1;
    let next = pct;
    if (orientation === "vertical") {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") next = pct + big;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = pct - big;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = 100;
      else if (e.key === "PageUp") next = pct + 10;
      else if (e.key === "PageDown") next = pct - 10;
      else return;
    } else {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = pct + big;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = pct - big;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = 100;
      else if (e.key === "PageUp") next = pct + 10;
      else if (e.key === "PageDown") next = pct - 10;
      else return;
    }
    e.preventDefault();
    commit(next);
  }

  const posStyle = round(pct, 3);
  const isVertical = orientation === "vertical";
  const maskStyle = maskUrl
    ? ({
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      } as React.CSSProperties)
    : undefined;

  const gutter = useMemo(
    () =>
      isVertical
        ? ({ left: `${posStyle}%` } as React.CSSProperties)
        : ({ top: `${posStyle}%` } as React.CSSProperties),
    [posStyle, isVertical],
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-background/60 select-none",
        className,
      )}
      role="group"
      aria-label={label}
      onPointerDown={onTrackPointerDown}
    >
      {/* base layer */}
      <div className="absolute inset-0">{before}</div>

      {/* revealed layer with the Bayer-dither dissolve mask */}
      <div ref={afterRef} className="absolute inset-0" style={maskStyle} aria-hidden="true">
        {after}
      </div>

      {/* divider track + handle (the dithered keycap-style edge) */}
      <div
        className={cn(
          "pointer-events-none absolute z-10",
          isVertical ? "top-0 bottom-0 -translate-x-1/2" : "left-0 right-0 -translate-y-1/2",
        )}
        style={gutter}
      >
        <button
          id={sliderHandleId}
          type="button"
          role="slider"
          aria-label={isVertical ? "Reveal amount" : "Reveal amount"}
          aria-orientation={isVertical ? "vertical" : "horizontal"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${Math.round(pct)} percent revealed`}
          tabIndex={0}
          className={cn(
            "pointer-events-auto flex touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            isVertical ? "h-full w-3 cursor-ew-resize" : "w-full h-3 cursor-ns-resize",
            dragging && "cursor-grabbing",
          )}
          style={
            handleTile
              ? ({
                  backgroundImage: `url(${handleTile})`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "3px 3px",
                  backgroundColor: "var(--foreground, #fff)",
                  boxShadow: reduced ? "none" : "0 0 0 1px rgba(0,0,0,0.35)",
                } as React.CSSProperties)
              : { backgroundColor: "var(--foreground, #fff)" }
          }
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onKeyDown={onHandleKeydown}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex items-center justify-center rounded-full border border-border bg-card text-[11px] font-mono text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
              isVertical ? "size-7" : "size-7 rotate-90",
            )}
          >
            ‹›
          </span>
        </button>
      </div>
    </div>
  );
}
