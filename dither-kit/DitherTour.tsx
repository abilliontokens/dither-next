"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { CONTROL_BUTTON } from "./control";
import { cn, px, round } from "./lib";
import { BAYER4, pixelPrefersReducedMotion } from "./pixel";
import { useFocusTrap } from "./use-focus-trap";
import { useInDom } from "./use-in-dom";

export interface DitherTourStep {
  /** CSS selector for the element to spotlight. */
  target: string;
  /** Coach-mark title. */
  title: string;
  /** Coach-mark body (arbitrary React). */
  body?: ReactNode;
}

export interface DitherTourProps {
  /** Whether the tour is running. */
  open: boolean;
  /** Ordered coach-mark steps. */
  steps: DitherTourStep[];
  /** Starting step index. */
  initialStep?: number;
  /** Pixel padding around each spotlighted target. */
  spotlightPad?: number;
  /** Scrim alpha (0–1) outside the cutout. */
  scrimAlpha?: number;
  /** Accessible label for the overlay. */
  label?: string;
  /** Button labels. */
  labels?: {
    back?: string;
    next?: string;
    done?: string;
    skip?: string;
  };
  className?: string;
  /** Fired on every step change (Escape / Skip / Done / backdrop click). */
  onClose?: () => void;
  /** Fired with the step index when the user finishes the last step. */
  onComplete?: (stepIndex: number) => void;
  /** Fired when the active step changes. */
  onStepChange?: (stepIndex: number) => void;
}

type Rect = { x: number; y: number; w: number; h: number };

/** Width of the Bayer feather band around each cutout. The scrim dissolves
 *  into the hole across this many pixels instead of hard-clipping. */
const FEATHER = 12;

/**
 * DitherTour — product-tour coach marks with a dithered spotlight cutout.
 *
 * Portals a full-screen scrim into `document.body` (gated on `useInDom`) with a
 * rectangular cutout over the current step's target. The cutout edge is a
 * **Bayer-ramp feather**: a `FEATHER`-px band around the hole where each pixel's
 * scrim alpha follows the `BAYER4` threshold against a distance density, so the
 * cutout dissolves into the page rather than hard-clipping. Implementation is
 * cheap — the whole viewport is filled with the scrim in one `fillRect`, then a
 * small `putImageData` carves only the (hole + feather) region, so a scroll or
 * step change repaints in well under a frame.
 *
 * The tooltip card auto-positions on the side of the target with the most
 * viewport room and flips if it would overflow. Focus is trapped in the card;
 * Escape / Skip / Done / backdrop all exit; an `aria-live` region announces
 * each step. Target rects are recomputed on scroll and resize (rAF-throttled).
 *
 * **State vs ref:** `index` and `hole` drive rendered DOM (card position +
 * canvas), so they are state. The rAF token and last scroll position are refs.
 *
 * **Hydration:** `getBoundingClientRect` is read only inside effects/handlers;
 * the SSR paint renders nothing (portal gated on `useInDom`), so the hole
 * rect's floats never reach server HTML.
 */
export function DitherTour({
  open,
  steps,
  initialStep = 0,
  spotlightPad = 10,
  scrimAlpha = 0.72,
  label = "Product tour",
  labels,
  className,
  onClose,
  onComplete,
  onStepChange,
}: DitherTourProps) {
  const inDom = useInDom();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef(0);

  const reactId = useId();
  const liveId = `${reactId}-live`;

  const lbl = {
    back: labels?.back ?? "Back",
    next: labels?.next ?? "Next",
    done: labels?.done ?? "Done",
    skip: labels?.skip ?? "Skip tour",
  };

  const [index, setIndex] = useState(initialStep);
  const [hole, setHole] = useState<Rect | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);

  const step = steps[index];

  const readHole = useCallback(() => {
    if (typeof document === "undefined" || !step) {
      setHole(null);
      return;
    }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setHole({
      x: r.left - spotlightPad,
      y: r.top - spotlightPad,
      w: r.width + spotlightPad * 2,
      h: r.height + spotlightPad * 2,
    });
  }, [step, spotlightPad]);

  // Paint the scrim + Bayer feather whenever the hole or scrim changes.
  useEffect(() => {
    if (!inDom || !open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    const baseA = Math.round(Math.max(0, Math.min(1, scrimAlpha)) * 255);

    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = `rgba(0,0,0,${(baseA / 255).toFixed(3)})`;
    ctx.fillRect(0, 0, vw, vh);

    if (!hole) return;

    const hx = Math.floor(hole.x - FEATHER);
    const hy = Math.floor(hole.y - FEATHER);
    const hw = Math.ceil(hole.w + FEATHER * 2);
    const hh = Math.ceil(hole.h + FEATHER * 2);
    if (hw <= 0 || hh <= 0) return;

    const img = ctx.createImageData(hw, hh);
    const data = img.data;
    for (let py = 0; py < hh; py++) {
      for (let px = 0; px < hw; px++) {
        const sx = hx + px;
        const sy = hy + py;
        const inside =
          sx >= hole.x && sx <= hole.x + hole.w && sy >= hole.y && sy <= hole.y + hole.h;
        const o = (py * hw + px) * 4;
        if (inside) {
          data[o + 3] = 0; // carve the hole
          continue;
        }
        // Signed distance to the hole rect (0 at the edge, growing outward).
        const dx = sx < hole.x ? hole.x - sx : sx > hole.x + hole.w ? sx - (hole.x + hole.w) : 0;
        const dy = sy < hole.y ? hole.y - sy : sy > hole.y + hole.h ? sy - (hole.y + hole.h) : 0;
        const dist = Math.max(dx, dy);
        const t = dist >= FEATHER ? 1 : dist / FEATHER; // 0 at edge → 1 at band end
        const density = t; // more scrim farther from the hole
        const lit = BAYER4[sy & 3][sx & 3] <= density;
        data[o + 3] = lit ? baseA : 0;
      }
    }
    ctx.putImageData(img, hx, hy);
  }, [inDom, open, hole, scrimAlpha]);

  // Recompute the hole on scroll / resize / step change (rAF-throttled).
  useEffect(() => {
    if (!inDom || !open) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(readHole);
    function onScroll(): void {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(readHole);
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [inDom, open, readHole]);

  // Focus trap + step announcement + focus the primary action on each step.
  useFocusTrap(cardRef, inDom && open);
  useEffect(() => {
    if (!inDom || !open) return;
    const id = window.setTimeout(() => nextBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [inDom, open, index]);

  useEffect(() => {
    if (open) onStepChange?.(index);
  }, [open, index, onStepChange]);

  // Reset to the start when reopened.
  useEffect(() => {
    if (open) setIndex(Math.min(initialStep, Math.max(0, steps.length - 1)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(delta: number): void {
    setIndex((i) => {
      const next = Math.min(steps.length - 1, Math.max(0, i + delta));
      return next;
    });
  }
  function finish(): void {
    onComplete?.(index);
    onClose?.();
  }

  if (!inDom || !open) return null;

  // --- card placement: pick the side with the most room, clamp into view -----
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const CARD_W = 300;
  const GAP = 16;
  let cardLeft: number;
  let cardTop: number;
  if (hole) {
    const right = vw - (hole.x + hole.w);
    const left = hole.x;
    const bottom = vh - (hole.y + hole.h);
    const top = hole.y;
    const best = Math.max(right, left, bottom, top);
    if (best === right && right >= CARD_W + GAP) {
      cardLeft = hole.x + hole.w + GAP;
      cardTop = Math.max(8, Math.min(vh - 180, hole.y));
    } else if (best === left && left >= CARD_W + GAP) {
      cardLeft = hole.x - CARD_W - GAP;
      cardTop = Math.max(8, Math.min(vh - 180, hole.y));
    } else if (best === bottom && bottom >= 200) {
      cardLeft = Math.max(8, Math.min(vw - CARD_W - 8, hole.x));
      cardTop = hole.y + hole.h + GAP;
    } else if (top >= 200) {
      cardLeft = Math.max(8, Math.min(vw - CARD_W - 8, hole.x));
      cardTop = hole.y - 200 + GAP;
    } else {
      // No good side — centre over the hole region, clamped into view.
      cardLeft = Math.max(8, Math.min(vw - CARD_W - 8, hole.x + hole.w / 2 - CARD_W / 2));
      cardTop = Math.max(8, Math.min(vh - 180, hole.y));
    }
  } else {
    cardLeft = (vw - CARD_W) / 2;
    cardTop = (vh - 180) / 2;
  }

  const announcement = step
    ? `Step ${index + 1} of ${steps.length}: ${step.title}`
    : `Step ${index + 1} of ${steps.length}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-describedby={liveId}
      onPointerDown={(e) => {
        // Backdrop (not the card) closes the tour. The scrim canvas is
        // pointer-events-none so clicks fall through to this root element.
        if (e.target === e.currentTarget) onClose?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose?.();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ imageRendering: "auto" }}
      />
      <span id={liveId} className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <div
        ref={cardRef}
        className={cn(
          "absolute z-10 w-[300px] rounded-xl border border-border/80 bg-card p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          className,
        )}
        style={{
          left: px(round(cardLeft, 2)),
          top: px(round(cardTop, 2)),
          transition: reduced ? "none" : "left 160ms ease, top 160ms ease",
        }}
      >
        {step ? (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">{step.title}</h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {index + 1}/{steps.length}
              </span>
            </div>
            {step.body ? (
              <div className="text-[12px] leading-relaxed text-muted-foreground">{step.body}</div>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className={cn(
                  CONTROL_BUTTON,
                  "rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground",
                )}
                onClick={onClose}
              >
                {lbl.skip}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={index <= 0}
                  className={cn(
                    CONTROL_BUTTON,
                    "rounded-md border border-border/70 bg-background/60 px-3 py-1 text-[12px] text-foreground hover:border-foreground/25",
                  )}
                  onClick={() => go(-1)}
                >
                  {lbl.back}
                </button>
                {index < steps.length - 1 ? (
                  <button
                    ref={nextBtnRef}
                    type="button"
                    className={cn(
                      CONTROL_BUTTON,
                      "rounded-md bg-foreground px-3 py-1 text-[12px] text-background hover:opacity-90",
                    )}
                    onClick={() => go(1)}
                  >
                    {lbl.next}
                  </button>
                ) : (
                  <button
                    ref={nextBtnRef}
                    type="button"
                    className={cn(
                      CONTROL_BUTTON,
                      "rounded-md bg-foreground px-3 py-1 text-[12px] text-background hover:opacity-90",
                    )}
                    onClick={finish}
                  >
                    {lbl.done}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
