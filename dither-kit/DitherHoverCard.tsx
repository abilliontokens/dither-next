"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "./lib";
import { colorToHex } from "./palette";
import { BAYER4, type PixelColor } from "./pixel";
import { useInDom } from "./use-in-dom";
import { usePresence } from "./use-presence";
import styles from "./overlay-transitions.module.css";

export type HoverCardSide = "top" | "bottom";
export type HoverCardAlign = "start" | "center" | "end";

export interface DitherHoverCardProps {
  /** The triggering element — pass a single focusable element (button / link)
   *  so keyboard focus can open the card. A non-focusable trigger falls back
   *  to a focusable wrapper span automatically. */
  children: ReactNode;
  /** Rich content shown in the card. */
  content: ReactNode;
  side?: HoverCardSide;
  align?: HoverCardAlign;
  /** Hover/focus open delay in ms. */
  delay?: number;
  /** Leave/blur close delay in ms. */
  closeDelay?: number;
  /** Gap between trigger and card in px. */
  gap?: number;
  /** Dither colour for the card's pixel border. */
  color?: PixelColor;
  /** Accessible description of the card region. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Bayer-ordered dither fill as an inline SVG data-URI tile (SSR-safe string
 * math). Used for the card's 1px dithered frame.
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
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${4 * cell}px ${4 * cell}px`,
  };
}

const FOCUSABLE_TAGS: Record<string, true> = {
  a: true,
  button: true,
  input: true,
  textarea: true,
  select: true,
  summary: true,
};

/**
 * DitherHoverCard — rich hover/focus card anchored to a trigger (Twitter /
 * GitHub-style profile preview cards).
 *
 * Pointer is NOT the only path in: focus opens the card too. When the trigger
 * is a natively focusable element (button / link / input) the card is
 * associated to it via `aria-describedby` (cloned onto the trigger) and focus
 * lands on the trigger itself; when it is not, the wrapper span becomes the
 * focusable surface so keyboard users still reach it. Both hover and focus
 * honour `delay` / `closeDelay`; Escape closes immediately.
 *
 * The card is portalled to `document.body` and positioned with `fixed`
 * coordinates measured from the trigger's rect, recomputed on scroll (capture,
 * to catch scrollable ancestors) and resize so it stays glued to the trigger.
 * `usePresence` keeps it mounted through its fade/slide leave. The border is a
 * genuine Bayer-dithered 1px frame rather than a solid line, so it reads as
 * part of the kit's texture. `role="tooltip"` matches the semantics of
 * "supplementary content revealed by the owning element".
 */
export function DitherHoverCard({
  children,
  content,
  side = "top",
  align = "center",
  delay = 500,
  closeDelay = 300,
  gap = 8,
  color = "blue",
  ariaLabel = "Additional information",
  className,
}: DitherHoverCardProps) {
  const inDom = useInDom();
  const reactId = useId();
  const cardId = `${reactId}-tooltip`;
  const [open, setOpen] = useState(false);
  const present = usePresence(open, 160); // keep mounted through the leave fade

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);

  const single = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const childProps = (single?.props ?? {}) as Record<string, unknown>;
  const childTag = typeof single?.type === "string" ? (single.type as string) : "";
  const hasTabIndex = typeof childProps["tabIndex"] === "number";
  const naturallyFocusable = FOCUSABLE_TAGS[childTag] === true || hasTabIndex;

  function scheduleOpen(): void {
    window.clearTimeout(closeTimer.current);
    if (open) return;
    openTimer.current = window.setTimeout(() => setOpen(true), delay);
  }
  function scheduleClose(): void {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), closeDelay);
  }
  function closeNow(): void {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    setOpen(false);
  }

  // Measure + position the card whenever it opens or its anchor inputs change.
  useEffect(() => {
    if (!open) return;
    function place(): void {
      const node = triggerRef.current;
      const card = cardRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const cw = card?.offsetWidth ?? 220;
      const ch = card?.offsetHeight ?? 80;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left =
        align === "start" ? r.left : align === "end" ? r.right - cw : r.left + r.width / 2 - cw / 2;
      let top = side === "top" ? r.top - ch - gap : r.bottom + gap;
      left = Math.max(8, Math.min(vw - cw - 8, left));
      if (top < 8) top = r.bottom + gap;
      if (top + ch > vh - 8) top = Math.max(8, r.top - ch - gap);
      setPos({ top, left });
    }
    place();
    // capture: scrollable ancestors bubble scroll only in capture phase.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, side, align, gap, content]);

  // Clear timers on unmount.
  useEffect(() => {
    return () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Escape closes immediately (window-level while open).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") closeNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const existingDescribedBy =
    typeof childProps["aria-describedby"] === "string" ? (childProps["aria-describedby"] as string) : "";
  const triggerDescribedBy = open
    ? existingDescribedBy
      ? `${existingDescribedBy} ${cardId}`
      : cardId
    : existingDescribedBy;
  const triggerNode = single
    ? cloneElement(
        single as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
        { "aria-describedby": triggerDescribedBy },
      )
    : <span className="inline-block">{children}</span>;

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-block", className)}
      tabIndex={naturallyFocusable ? undefined : 0}
      aria-describedby={naturallyFocusable ? undefined : open ? cardId : undefined}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeNow();
      }}
    >
      {triggerNode}
      {inDom && present
        ? createPortal(
            <div
              ref={cardRef}
              id={cardId}
              role="tooltip"
              aria-label={ariaLabel}
              className={cn(
                styles.popPanel,
                "fixed z-50 max-w-xs rounded-md shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]",
                !open && styles.popHide,
              )}
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                visibility: pos ? "visible" : "hidden",
                // The 1px frame is a Bayer-dithered tile; the inner block is solid card.
                padding: 1,
                ...bayerFill(color, 0.6),
              }}
              onMouseEnter={scheduleOpen}
              onMouseLeave={scheduleClose}
            >
              <div className="rounded-[3px] bg-card px-3 py-2 text-[12px] leading-relaxed text-foreground">
                {content}
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
