"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CONTROL_BUTTON } from "./control";
import { project, rubberband, velocityFrom, type VelocitySample } from "./gesture";
import { cn } from "./lib";
import { colorToHex } from "./palette";
import {
  BAYER4,
  clamp01,
  fillOf,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";
import { useFocusTrap } from "./use-focus-trap";
import { useInDom } from "./use-in-dom";
import { usePresence } from "./use-presence";
import styles from "./overlay-transitions.module.css";

export interface DitherBottomSheetProps {
  open: boolean;
  title?: string;
  /** Pointer-drag down on the handle / panel body dismisses the sheet. */
  swipe?: boolean;
  /** false keeps the sheet open on backdrop click (Escape still closes). */
  dismissible?: boolean;
  /** Dither fill colour for the grabber handle. */
  color?: PixelColor;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Bayer-ordered dither fill as an inline SVG data-URI tile. Pure string math,
 * so it is SSR-safe to call from render. The grabber handle reads as the kit's
 * scattered pixels, not a solid bar.
 */
function bayerFill(color: PixelColor, intensity: number): React.CSSProperties {
  const hex = colorToHex(color);
  const cell = 2;
  const rects: string[] = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER4[y][x] <= intensity) {
        rects.push(
          `<rect x='${x * cell}' y='${y * cell}' width='${cell}' height='${cell}' fill='${hex}'/>`,
        );
      }
    }
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${4 * cell}' height='${4 * cell}'>` +
    `${rects.join("")}</svg>`;
  const [r, g, b] = fillOf(color);
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${4 * cell}px ${4 * cell}px`,
    backgroundColor: `rgba(${r},${g},${b},0.12)`,
  };
}

/**
 * DitherBottomSheet — modal panel that slides up from the bottom edge.
 *
 * Unlike `DitherDrawer` (side-drawer) this is bottom-only with a true focus
 * trap and a drag-to-dismiss grabber. The gesture contract mirrors the drawer:
 * 1:1 pointer tracking via `setPointerCapture`, free drag up to a dismiss
 * threshold then `rubberband` resistance grows, and on release `velocityFrom`
 * + `project` decide a flick — all math lives in `./gesture`, never here.
 *
 * Overlay idiom follows `DitherDialog`/`DitherDrawer`: a portal to
 * `document.body` gated on `useInDom()`, `usePresence` keeps the panel mounted
 * through its leave slide, `useFocusTrap` owns Tab cycling + focus restoration,
 * Escape closes (with `stopPropagation` so a nested sheet's Escape does not
 * double-fire), and the close button is focused on open. The grabber handle is
 * a Bayer-dithered capsule so the affordance reads as part of the kit's
 * texture. `prefers-reduced-motion` snaps the dismiss (closes immediately).
 */
export function DitherBottomSheet({
  open,
  title,
  swipe = true,
  dismissible = true,
  color = "blue",
  onClose,
  children,
  className,
}: DitherBottomSheetProps) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const inDom = useInDom();
  const mounted = usePresence(open, 240);

  // `entered` flips on the frame after mount so the enter slide (translateY
  // 100% → 0) actually transitions — a fresh DOM node does not transition from
  // its initial value, so we start it off-screen and animate in.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Focus the close button once the panel is in the DOM (Vue nextTick → rAF).
  useEffect(() => {
    if (!inDom || !mounted || !open) return;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [inDom, mounted, open]);

  useFocusTrap(panelRef, inDom && mounted && open);

  // --- drag-to-dismiss: 1:1 up to threshold, rubberband past it ------------
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const startRef = useRef(0);
  const panelHeightRef = useRef(240);
  const samplesRef = useRef<VelocitySample[]>([]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!swipe) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, textarea, select, [data-no-swipe]")) return;
    const panel = panelRef.current;
    if (!panel) return;
    draggingRef.current = true;
    setDragging(true);
    startRef.current = e.clientY;
    panelHeightRef.current = panel.offsetHeight || 240;
    samplesRef.current = [{ t: e.timeStamp, p: e.clientY }];
    panel.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current) return;
    const samples = samplesRef.current;
    samples.push({ t: e.timeStamp, p: e.clientY });
    if (samples.length > 6) samples.shift();
    const delta = e.clientY - startRef.current; // downward +
    const raw = delta < 0 ? 0 : delta;
    const h = panelHeightRef.current;
    // 1:1 until the dismiss threshold, then progressive rubberband resistance.
    const threshold = Math.max(80, h * 0.2);
    const next =
      raw <= threshold ? raw : threshold + rubberband(raw - threshold, h);
    offsetRef.current = next;
    setOffset(next);
  }

  function dismiss(): void {
    if (pixelPrefersReducedMotion()) {
      offsetRef.current = 0;
      setOffset(0);
      onCloseRef.current?.();
      return;
    }
    // Animate the rest of the way down, then close.
    const h = panelHeightRef.current || 240;
    offsetRef.current = h;
    setOffset(h);
    window.setTimeout(() => {
      onCloseRef.current?.();
      offsetRef.current = 0;
      setOffset(0);
    }, 220);
  }

  function onPointerUp(): void {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const v = velocityFrom(samplesRef.current); // px/s, downward +
    const projected = offsetRef.current + project(v);
    const h = panelHeightRef.current;
    const threshold = Math.max(80, h * 0.2);
    if (offsetRef.current >= threshold || v > 500 || projected > h * 0.5) {
      dismiss();
    } else {
      offsetRef.current = 0;
      setOffset(0);
    }
  }

  if (!inDom || !mounted) return null;

  const resting = open && entered;
  const panelTransform =
    offset > 0 ? `translateY(${offset}px)` : resting ? "translateY(0)" : "translateY(100%)";
  // Backdrop dims as the sheet is dragged away.
  const backdropOpacity = 0.6 * (1 - clamp01(offset / (panelHeightRef.current || 1)));

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className={cn(
          styles.fadeBackdrop,
          "absolute inset-0 bg-black/60",
          !open && styles.fadeHide,
        )}
        style={{
          opacity: dragging || offset > 0 ? backdropOpacity : undefined,
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (dismissible) onClose?.();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Bottom sheet"}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-xl border border-border/80 bg-card shadow-[0_-12px_48px_-16px_rgba(0,0,0,0.7)]",
          dragging ? "select-none" : "transition-transform motion-reduce:transition-none",
          className,
        )}
        style={{ transform: panelTransform }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose?.();
          }
        }}
      >
        {/* Dithered grabber handle — the drag affordance, Bayer-textured. */}
        <div className="flex shrink-0 justify-center pt-3">
          <span
            aria-hidden="true"
            className="h-1.5 w-12 touch-none rounded-full"
            style={{ ...bayerFill(color, 0.55), cursor: swipe ? "grab" : "default" }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          {title ? (
            <h2 id={titleId} className="min-w-0 truncate text-sm font-medium text-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            ref={closeRef}
            type="button"
            className={cn(
              CONTROL_BUTTON,
              "flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground",
            )}
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            ×
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-5"
          data-no-swipe
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
