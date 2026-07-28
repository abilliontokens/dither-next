"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { BAYER4, clamp01 } from "./pixel";
import { useCanvasVisibility } from "./use-visibility";

/** A normalised crop rect (0–1 relative to the cropper box). */
export type CropRect = { x: number; y: number; width: number; height: number };

/** Imperative surface exposed via the ref. */
export type DitherImageCropperHandle = {
  /** Render the current crop region from the source image at native resolution
   *  and return it as a data URL (PNG by default). Returns `null` until the
   *  image has loaded. */
  toDataURL: (type?: string, quality?: number) => string | null;
};

export interface DitherImageCropperProps {
  /** Source image URL. */
  src: string;
  /** When set, locks the crop's width/height to this ratio (e.g. 16/9, 1). */
  aspect?: number;
  /** Controlled crop rect (normalised 0–1). */
  rect?: CropRect;
  /** Initial crop rect when uncontrolled. Defaults to a centred 80% box. */
  defaultRect?: CropRect;
  /** Fired with the normalised rect whenever the crop changes. */
  onChange?: (rect: CropRect) => void;
  /** Accessible label. */
  label?: string;
  /** Minimum crop size as a fraction of the box (per side). */
  minSize?: number;
  className?: string;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: { id: Handle; cursor: string; pos: string }[] = [
  { id: "nw", cursor: "nwse-resize", pos: "left-0 top-0 -translate-x-1/2 -translate-y-1/2" },
  { id: "n", cursor: "ns-resize", pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
  { id: "ne", cursor: "nesw-resize", pos: "right-0 top-0 translate-x-1/2 -translate-y-1/2" },
  { id: "e", cursor: "ew-resize", pos: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" },
  { id: "se", cursor: "nwse-resize", pos: "right-0 bottom-0 translate-x-1/2 translate-y-1/2" },
  { id: "s", cursor: "ns-resize", pos: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { id: "sw", cursor: "nesw-resize", pos: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { id: "w", cursor: "ew-resize", pos: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" },
];

const clampRect = (r: CropRect, min: number): CropRect => {
  let w = Math.max(min, Math.min(1, r.width));
  let h = Math.max(min, Math.min(1, r.height));
  let x = clamp01(r.x);
  let y = clamp01(r.y);
  if (x + w > 1) x = 1 - w;
  if (y + h > 1) y = 1 - h;
  return { x, y, width: w, height: h };
};

/** Apply a handle drag to a crop rect, honouring an optional aspect lock.
 *  Corners re-anchor the opposite corner; edges recentre the perpendicular
 *  axis when aspect is set. Pure. */
function resizeCrop(handle: Handle, c: CropRect, dx: number, dy: number, aspect: number, min: number): CropRect {
  let left = c.x;
  let right = c.x + c.width;
  let top = c.y;
  let bottom = c.y + c.height;
  const moveLeft = handle.includes("w");
  const moveRight = handle.includes("e");
  const moveTop = handle.includes("n");
  const moveBottom = handle.includes("s");
  if (moveLeft) left = clamp01(c.x + dx);
  if (moveRight) right = clamp01(c.x + c.width + dx);
  if (moveTop) top = clamp01(c.y + dy);
  if (moveBottom) bottom = clamp01(c.y + c.height + dy);
  let w = Math.max(min, right - left);
  let h = Math.max(min, bottom - top);
  if (aspect > 0) {
    const horiz = moveLeft || moveRight;
    const vert = moveTop || moveBottom;
    if (horiz && !vert) {
      h = w / aspect;
      const mid = top + (bottom - top) / 2;
      top = mid - h / 2;
      bottom = mid + h / 2;
    } else if (vert && !horiz) {
      w = h * aspect;
      const mid = left + (right - left) / 2;
      left = mid - w / 2;
      right = mid + w / 2;
    } else {
      // Corner: drive by whichever axis grew more relative to the aspect.
      if (w / aspect >= h) h = w / aspect;
      else w = h * aspect;
      if (moveLeft) right = left + w;
      if (moveRight) left = right - w;
      if (moveTop) bottom = top + h;
      if (moveBottom) top = bottom - h;
    }
  }
  return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, min);
}

/**
 * DitherImageCropper — crop an image with pan/zoom and an 8-handle crop box.
 *
 * The image is drawn to a canvas through a pan/zoom transform (wheel zooms
 * about the cursor, drag on the dimmed area pans). The crop box is a DOM
 * overlay with eight resize handles and a move zone; an optional `aspect`
 * locks the ratio. The area **outside** the crop is masked with an
 * **ordered-dither scrim**: a 4×4 Bayer tile is baked once and applied as a
 * `createPattern` fill over the four regions around the crop, so the mask
 * reads as the kit's stipple instead of a flat alpha wash. `toDataURL()` is
 * exposed via the imperative handle and renders the crop from the source image
 * at native resolution.
 *
 * **State vs ref:** the crop `rect` drives the DOM overlay AND the scrim
 * repaint, so it is state — but it is mirrored into `cropRef` so the stable
 * `paint()` closure (called from the image `onload`, the `ResizeObserver`, and
 * the pan/zoom handlers) always reads the latest value. The pan/zoom transform
 * is canvas-only, so it lives entirely in a ref and is never read during
 * render. The Bayer pattern tile and the loaded `HTMLImageElement` are refs for
 * the same reason. This mirrors `DitherSignaturePad`'s "geometry in a ref,
 * only derived flags in state" contract.
 *
 * Accessibility: the crop box is a focusable `role="group"`; arrows nudge it
 * (Shift = 10×). Each handle is a labelled button with a resize cursor and a
 * visible focus ring. The canvas is `role="img"` with a state-aware label.
 */
export const DitherImageCropper = forwardRef<
  DitherImageCropperHandle,
  DitherImageCropperProps
>(function DitherImageCropper(
  { src, aspect = 0, defaultRect, rect, onChange, label = "Image cropper", minSize = 0.05, className },
  ref,
) {
  const reactId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedRef = useRef(false);
  const patternRef = useRef<CanvasPattern | null>(null);
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const cropRef = useRef<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const dimsRef = useRef({ w: 0, h: 0 });
  const dragRef = useRef<{
    kind: "move" | "resize";
    handle?: Handle;
    start: CropRect;
    client: { x: number; y: number };
  } | null>(null);
  const panRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const controlled = rect !== undefined;
  const [internal, setInternal] = useState<CropRect>(
    defaultRect ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  );
  const crop = controlled ? rect : internal;
  cropRef.current = crop; // mirror for the stable paint() closure

  const [ready, setReady] = useState(false);

  // --- paint: image (transformed) + Bayer-dither scrim outside the crop -----
  function paint(): void {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dimsRef.current = { w, h };
    ctx.clearRect(0, 0, w, h);

    const img = imgRef.current;
    if (img && loadedRef.current) {
      const t = transformRef.current;
      ctx.save();
      ctx.translate(t.tx, t.ty);
      ctx.scale(t.scale, t.scale);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

    // Scrim: the four regions around the crop, filled with the Bayer pattern.
    const c = cropRef.current;
    const cx = c.x * w;
    const cy = c.y * h;
    const cw = c.width * w;
    const ch = c.height * h;
    if (patternRef.current) {
      ctx.fillStyle = patternRef.current;
      // top, bottom, left, right (L-shape expressed as 4 rects)
      ctx.fillRect(0, 0, w, Math.max(0, cy));
      ctx.fillRect(0, cy + ch, w, Math.max(0, h - (cy + ch)));
      ctx.fillRect(0, cy, Math.max(0, cx), ch);
      ctx.fillRect(cx + cw, cy, Math.max(0, w - (cx + cw)), ch);
    }
    // Crisp crop frame.
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, Math.max(0, cw - 1), Math.max(0, ch - 1));
  }

  // Bake the Bayer pattern tile once on mount (client-only).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 4, 4);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (BAYER4[y][x] <= 0.5) ctx.fillRect(x, y, 1, 1);
      }
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const cctx = canvas.getContext("2d");
      patternRef.current = cctx ? cctx.createPattern(c, "repeat") : null;
    }
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the image.
  useEffect(() => {
    loadedRef.current = false;
    setReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      loadedRef.current = true;
      // Fit-contain + centre on first load.
      const root = rootRef.current;
      if (root) {
        const r = root.getBoundingClientRect();
        const fit = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
        const scale = fit > 0 ? fit : 1;
        transformRef.current = {
          scale,
          tx: (r.width - img.naturalWidth * scale) / 2,
          ty: (r.height - img.naturalHeight * scale) / 2,
        };
      }
      setReady(true);
      paint();
    };
    return () => {
      img.onload = null;
    };
  }, [src]);

  // Repaint on crop / ready change + resize.
  useEffect(() => {
    paint();
  }, [crop, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useCanvasVisibility(canvasRef, paint);

  function commit(next: CropRect): void {
    const clamped = clampRect(next, minSize);
    if (!controlled) setInternal(clamped);
    cropRef.current = clamped;
    onChange?.(clamped);
    paint();
  }

  // --- imperative handle ----------------------------------------------------
  useImperativeHandle(
    ref,
    () => ({
      toDataURL: (type = "image/png", quality) => {
        const img = imgRef.current;
        const root = rootRef.current;
        if (!img || !loadedRef.current || !root) return null;
        const r = root.getBoundingClientRect();
        const t = transformRef.current;
        const c = cropRef.current;
        // Crop in container px → image px.
        const cx = c.x * r.width;
        const cy = c.y * r.height;
        const cw = c.width * r.width;
        const ch = c.height * r.height;
        const sx = (cx - t.tx) / t.scale;
        const sy = (cy - t.ty) / t.scale;
        const sw = cw / t.scale;
        const sh = ch / t.scale;
        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(Math.abs(sw)));
        out.height = Math.max(1, Math.round(Math.abs(sh)));
        const octx = out.getContext("2d");
        if (!octx) return null;
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
        try {
          return out.toDataURL(type, quality);
        } catch {
          return null;
        }
      },
    }),
    [],
  );

  // --- pointer: pan (on the dimmed canvas area) -----------------------------
  function onCanvasPointerDown(e: ReactPointerEvent<HTMLCanvasElement>): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onCanvasPointerMove(e: ReactPointerEvent<HTMLCanvasElement>): void {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    const t = transformRef.current;
    t.tx += e.clientX - p.x;
    t.ty += e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    paint();
  }
  function onCanvasPointerUp(e: ReactPointerEvent<HTMLCanvasElement>): void {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    panRef.current = null;
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const t = transformRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const next = Math.max(0.05, Math.min(12, t.scale * factor));
    const imgX = (cx - t.tx) / t.scale;
    const imgY = (cy - t.ty) / t.scale;
    t.scale = next;
    t.tx = cx - imgX * next;
    t.ty = cy - imgY * next;
    paint();
  }

  // --- pointer: crop move / resize (on the overlay) -------------------------
  function rectDelta(e: ReactPointerEvent): { dx: number; dy: number } {
    const r = rootRef.current!.getBoundingClientRect();
    const d = dragRef.current!.client;
    return {
      dx: (e.clientX - d.x) / Math.max(1, r.width),
      dy: (e.clientY - d.y) / Math.max(1, r.height),
    };
  }
  function onOverlayPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      start: { ...cropRef.current },
      client: { x: e.clientX, y: e.clientY },
    };
  }
  function onOverlayPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const d = dragRef.current;
    if (!d || d.kind !== "move") return;
    const { dx, dy } = rectDelta(e);
    const s = d.start;
    commit(clampRect({ x: s.x + dx, y: s.y + dy, width: s.width, height: s.height }, minSize));
  }
  function onOverlayPointerUp(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    dragRef.current = null;
  }

  function onHandlePointerDown(h: Handle) {
    return (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        kind: "resize",
        handle: h,
        start: { ...cropRef.current },
        client: { x: e.clientX, y: e.clientY },
      };
    };
  }
  function onHandlePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    const d = dragRef.current;
    if (!d || d.kind !== "resize" || !d.handle) return;
    const { dx, dy } = rectDelta(e);
    const next = resizeCrop(d.handle, d.start, dx, dy, aspect, minSize);
    if (aspect > 0) {
      const constrained = { ...next, height: next.width / aspect };
      commit(clampRect(constrained, minSize));
    } else {
      commit(next);
    }
  }
  function onHandlePointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    dragRef.current = null;
  }

  // --- keyboard nudge on the crop box ---------------------------------------
  function onOverlayKeydown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    const big = e.shiftKey ? 0.1 : 0.01;
    let { x, y } = cropRef.current;
    if (e.key === "ArrowRight") x += big;
    else if (e.key === "ArrowLeft") x -= big;
    else if (e.key === "ArrowDown") y += big;
    else if (e.key === "ArrowUp") y -= big;
    else return;
    e.preventDefault();
    commit(clampRect({ ...cropRef.current, x, y }, minSize));
  }

  const overlayStyle: React.CSSProperties = {
    left: `${(crop.x * 100).toFixed(3)}%`,
    top: `${(crop.y * 100).toFixed(3)}%`,
    width: `${(crop.width * 100).toFixed(3)}%`,
    height: `${(crop.height * 100).toFixed(3)}%`,
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-background/60 select-none",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${label}${ready ? " — image loaded, drag to pan, scroll to zoom" : " — loading image"}`}
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{ imageRendering: "auto" }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={onWheel}
      />

      <div
        ref={overlayRef}
        tabIndex={0}
        role="group"
        aria-label={`${label}, crop region. Arrow keys to move.`}
        className="absolute z-10 cursor-move touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        style={overlayStyle}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUp}
        onPointerCancel={onOverlayPointerUp}
        onKeyDown={onOverlayKeydown}
      >
        {HANDLES.map((h) => (
          <button
            key={h.id}
            type="button"
            aria-label={`Resize ${h.id}`}
            tabIndex={-1}
            className={cn(
              CONTROL_BUTTON,
              "absolute size-3 rounded-[2px] border border-foreground/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:bg-background focus-visible:ring-2 focus-visible:ring-accent/60",
              h.pos,
            )}
            style={{ cursor: h.cursor }}
            onPointerDown={onHandlePointerDown(h.id)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          />
        ))}
      </div>

      <span className="sr-only" aria-hidden="true" id={`${reactId}-hint`}>
        Scroll to zoom, drag the dimmed area to pan, drag handles to resize.
      </span>
    </div>
  );
});
