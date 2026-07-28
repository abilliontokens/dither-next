"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { CONTROL_BUTTON } from "./control";
import { cn, round } from "./lib";
import { BAYER4, clamp01, fillOf, pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { cssColor, rgb, type Rgb } from "./palette";
import { useInDom } from "./use-in-dom";

const CELL = 2;

export type QueueVariant = "info" | "success" | "warning" | "error";

export type QueuePosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface QueueAction {
  label: string;
  onClick: () => void;
}

/**
 * One card in the queue. NOT the imperative-store `Toast` from `./toast` — that
 * type is a flat `{ id, message, color, duration }` bound to the module-level
 * emitter, with `color` required and a single message string. The queue is a
 * positioned, controlled card stack: it needs a split `title`/`body`, a semantic
 * `variant` (mapped to a kit colour), and an optional `action`, all supplied by a
 * `toasts` prop the parent owns. The shapes are structurally incompatible, so a
 * parallel type is correct rather than overloading `Toast`.
 */
export interface QueueToast {
  /** Stable id; passed back to `onDismiss`. */
  id: number;
  title: string;
  body?: string;
  variant?: QueueVariant;
  action?: QueueAction;
  /** Auto-dismiss delay in seconds. Defaults to `5`; `0` is sticky (no timer). */
  duration?: number;
}

export interface DitherCommandQueueProps {
  /** Visible cards, oldest→newest (newest is rendered on top). */
  toasts: QueueToast[];
  onDismiss: (id: number) => void;
  /** Viewport corner the stack anchors to. */
  position?: QueuePosition;
  className?: string;
}

const VARIANT_META: Record<
  QueueVariant,
  { color: PixelColor; role: "status" | "alert"; live: "polite" | "assertive" }
> = {
  info: { color: "blue", role: "status", live: "polite" },
  success: { color: "green", role: "status", live: "polite" },
  warning: { color: "orange", role: "alert", live: "assertive" },
  error: { color: "red", role: "alert", live: "assertive" },
};

const CORNER_CLASS: Record<QueuePosition, string> = {
  "top-right": "fixed top-4 right-4 z-[60] flex flex-col items-end gap-2",
  "top-left": "fixed top-4 left-4 z-[60] flex flex-col items-start gap-2",
  "bottom-right": "fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-2",
  "bottom-left": "fixed bottom-4 left-4 z-[60] flex flex-col-reverse items-start gap-2",
};

/** Off-screen entrance transform — slide in from the anchor edge, settle to 0. */
const OFF_TRANSFORM: Record<QueuePosition, string> = {
  "top-right": "translateX(120%)",
  "bottom-right": "translateX(120%)",
  "top-left": "translateX(-120%)",
  "bottom-left": "translateX(-120%)",
};

/**
 * Paint the dithered progress strip: columns up to `frac` of the width render as
 * a dense Bayer wash of the variant fill (the remaining time), the rest as a
 * faint muted wash. Reads the live width each call so it survives resize. This
 * is the card's signature dither element — density, not a flat coloured bar.
 */
function paintProgress(
  canvas: HTMLCanvasElement,
  frac: number,
  fill: Rgb,
  paused: boolean,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cols = Math.max(8, Math.round(canvas.clientWidth / CELL));
  const rows = 2;
  if (canvas.width !== cols) canvas.width = cols;
  if (canvas.height !== rows) canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  const muted = fillOf("grey");
  const cutoff = Math.round(cols * clamp01(frac));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tx = BAYER4[y & 3][x & 3];
      let col: Rgb;
      let alpha: number;
      if (x < cutoff) {
        col = fill;
        const lit = (paused ? 0.92 : 0.8) > tx;
        alpha = lit ? 0.9 : 0.32;
      } else {
        col = muted;
        alpha = 0.18 > tx ? 0.22 : 0.05;
      }
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(col, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Paint a faint Bayer wash as a silhouette — the stacked-card peek behind front. */
function paintPeek(canvas: HTMLCanvasElement, fill: Rgb): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cols = Math.max(4, Math.round(canvas.clientWidth / CELL));
  const rows = Math.max(4, Math.round(canvas.clientHeight / CELL));
  if (canvas.width !== cols) canvas.width = cols;
  if (canvas.height !== rows) canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const alpha = 0.32 > BAYER4[y & 3][x & 3] ? 0.16 : 0.04;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

interface QueueCardProps {
  toast: QueueToast;
  position: QueuePosition;
  onDismiss: (id: number) => void;
  isFront: boolean;
  peekCount: number;
}

/**
 * A single notification card. The countdown lives entirely in refs because the
 * progress strip is a canvas — its pixels are the render target, so elapsed-time
 * geometry is ref-side data (see the state-vs-ref rule; `DitherSignaturePad`
 * documents the same carve-out). Only `entered`/`reduced` (which toggle
 * class/inline-style and so MUST re-render) are state. `onDismiss` is mirrored
 * into a ref so a changing parent callback identity never restarts the timer.
 */
function QueueCard({ toast, position, onDismiss, isFront, peekCount }: QueueCardProps) {
  const meta = VARIANT_META[toast.variant ?? "info"];
  const fill = useMemo<Rgb>(() => fillOf(meta.color), [meta.color]);
  const ms = (toast.duration ?? 5) * 1000;
  const sticky = ms <= 0;

  const reactId = useId();
  const titleId = `${reactId}-title`;

  const articleRef = useRef<HTMLElement | null>(null);
  const progRef = useRef<HTMLCanvasElement | null>(null);
  const peekRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  const [entered, setEntered] = useState(false);
  const [reduced, setReduced] = useState(false);

  const endRef = useRef<number | null>(null);
  const remainingRef = useRef<number>(ms);
  const pausedRef = useRef<boolean>(false);
  const dismissedRef = useRef<boolean>(false);
  const onDismissRef = useRef(onDismiss);

  // Entrance: mount hidden, commit shown next frame so the CSS transition plays
  // (same idiom as DitherToaster's `entered`). `matchMedia` is server-unknowable.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);
  // Keep the latest onDismiss without restarting the countdown — the timer loop
  // reads this ref at dismissal time, so a changing parent callback identity is
  // invisible to the per-card countdown (the effect has no deps → runs each
  // commit, cheaper than it sounds for a handful of cards).
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Countdown loop: paints the dithered strip each frame and fires onDismiss at
  // elapsed. Runs once per card; every value it reads is a ref, so adding a
  // sibling toast (which re-renders the parent) never resets this card's timer.
  useEffect(() => {
    if (sticky) return;
    endRef.current = performance.now() + ms;
    remainingRef.current = ms;
    pausedRef.current = false;
    let raf = 0;
    const tick = (): void => {
      const now = performance.now();
      let remaining: number;
      if (pausedRef.current) {
        remaining = remainingRef.current;
      } else if (endRef.current !== null) {
        remaining = endRef.current - now;
        if (remaining <= 0) {
          if (!dismissedRef.current) {
            dismissedRef.current = true;
            onDismissRef.current(toast.id);
          }
          return;
        }
      } else {
        remaining = remainingRef.current;
      }
      const cv = progRef.current;
      if (cv) paintProgress(cv, remaining / ms, fill, pausedRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Mount-once: `ms`/`fill`/`toast.id` are stable per card instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint the silhouette peeks (front card only) on mount + resize.
  useEffect(() => {
    if (!isFront || peekCount <= 0) return;
    let ro: ResizeObserver | null = null;
    const paint = (): void => {
      peekRefs.current.forEach((cv) => {
        if (cv) paintPeek(cv, fill);
      });
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && articleRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(articleRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [isFront, peekCount, fill]);

  function pause(): void {
    if (sticky || pausedRef.current) return;
    pausedRef.current = true;
    if (endRef.current !== null) {
      remainingRef.current = Math.max(0, endRef.current - performance.now());
      endRef.current = null;
    }
  }
  function resume(): void {
    if (sticky || !pausedRef.current) return;
    pausedRef.current = false;
    endRef.current = performance.now() + remainingRef.current;
  }
  function runAction(): void {
    toast.action?.onClick();
    // An acknowledged action dismisses the card (the standard toast contract).
    onDismiss(toast.id);
  }

  const announce = toast.body ? `${toast.title}: ${toast.body}` : toast.title;

  // Constant strings only — no computed floats reach the style attribute, so the
  // entrance is hydration-safe. Reduced motion drops the slide for an opacity fade.
  const enterStyle: CSSProperties = reduced
    ? { opacity: entered ? 1 : 0, transition: "opacity 160ms ease" }
    : {
        opacity: entered ? 1 : 0,
        transform: entered ? "translateX(0)" : OFF_TRANSFORM[position],
        transition: "transform 240ms cubic-bezier(0.2,0.85,0.3,1.04), opacity 160ms ease",
      };

  const awayX = position.endsWith("right") ? -1 : 1;
  const awayY = position.startsWith("bottom") ? -1 : 1;

  return (
    <div className="relative w-80">
      {isFront && peekCount > 0
        ? Array.from({ length: peekCount }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 overflow-hidden rounded-lg border border-border/40"
              style={{
                left: 0,
                right: 0,
                height: `calc(100% - ${(i + 1) * 5}px)`,
                transform: `translate(${awayX * (i + 1) * 6}px, ${awayY * (i + 1) * 5}px)`,
                zIndex: -1,
                opacity: round(0.7 - i * 0.22, 2),
              }}
            >
              <canvas
                ref={(el) => {
                  peekRefs.current[i] = el;
                }}
                aria-hidden="true"
                className="h-full w-full"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          ))
        : null}
      <article
        ref={articleRef}
        role={meta.role}
        aria-live={meta.live}
        aria-atomic="true"
        aria-label={announce}
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocus={pause}
        onBlur={resume}
        className={cn(
          CONTROL_BUTTON,
          "pointer-events-auto relative w-full overflow-hidden rounded-lg border border-border/80 bg-card px-3 py-2 font-mono text-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.32)]",
        )}
        style={enterStyle}
      >
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1 size-2 shrink-0 rounded-[1px]"
            style={{ backgroundColor: cssColor(meta.color), imageRendering: "pixelated" }}
          />
          <div className="min-w-0 flex-1">
            <p id={titleId} className="font-medium leading-tight text-foreground">
              {toast.title}
            </p>
            {toast.body ? (
              <p className="mt-0.5 leading-snug text-muted-foreground">{toast.body}</p>
            ) : null}
          </div>
          {toast.action ? (
            <button
              type="button"
              onClick={runAction}
              className="shrink-0 rounded border border-border/60 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-background"
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
        {!sticky ? (
          <canvas
            ref={progRef}
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[3px] w-full"
            style={{ imageRendering: "pixelated" }}
          />
        ) : null}
      </article>
    </div>
  );
}

/**
 * DitherCommandQueue — a positioned stack of dismissible notification cards
 * anchored to a viewport corner. Distinct from `DitherToaster`, which is the
 * low-level imperative toast primitive (a flat `{message}` card driven by the
 * module-level `toast()` store). This is the *positioned queue UI*: a controlled
 * `toasts`/`onDismiss` surface with four corners, per-variant `role`/`aria-live`,
 * an action button, hover/focus-pausable auto-dismiss, and a Bayer-dithered
 * countdown strip.
 *
 * The newest card is the front of the stack (highest z, nearest the anchor
 * corner); it springs in from the off-screen edge and settles (a pure opacity
 * fade under reduced motion). The countdown is a dithered progress strip along
 * the card's long edge that shrinks as time runs out — density, not a flat hue.
 * Stacked cards behind the front render as a faint dithered silhouette peek.
 *
 * Not modal: no focus trap. Each card is `role="status"` (info/success) or
 * `role="alert"` (warning/error) with a matching `aria-live`. Escape dismisses
 * the front card; Tab walks each card's action + dismiss buttons; Enter
 * activates the focused button (native). Hover or focus pauses the countdown.
 *
 * SSR-safe: the portal is gated on `useInDom()`; `matchMedia` (reduced motion)
 * and `performance.now()` are read only inside effects.
 */
export function DitherCommandQueue({
  toasts,
  onDismiss,
  position = "top-right",
  className,
}: DitherCommandQueueProps) {
  const inDom = useInDom();
  // Newest on top: the last array entry is newest; render newest-first so it
  // lands nearest the anchor corner (flex-col for top, flex-col-reverse for bottom).
  const ordered = useMemo<QueueToast[]>(() => [...toasts].reverse(), [toasts]);
  const front = ordered[0];
  const peekCount = Math.min(2, Math.max(0, ordered.length - 1));

  function onKeydown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Escape" && front) {
      e.stopPropagation();
      onDismiss(front.id);
    }
  }

  if (!inDom || ordered.length === 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className={cn(CORNER_CLASS[position], className)}
      onKeyDown={onKeydown}
    >
      {ordered.map((t, i) => (
        <QueueCard
          key={t.id}
          toast={t}
          position={position}
          onDismiss={onDismiss}
          isFront={i === 0}
          peekCount={i === 0 ? peekCount : 0}
        />
      ))}
    </div>,
    document.body,
  );
}
