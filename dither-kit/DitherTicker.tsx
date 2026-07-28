"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "./lib";
import { colorToHex } from "./palette";
import {
  BAYER4,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";
import { useCanvasVisibility } from "./use-visibility";

export type TickerDirection = "left" | "right";

export interface DitherTickerProps {
  /** Item strings; ignored when `children` is supplied. */
  items?: string[];
  /** Raw content node (separators not inserted between children). */
  children?: ReactNode;
  /** Scroll speed in px/s. */
  speed?: number;
  direction?: TickerDirection;
  /** Pause on pointer hover and keyboard focus. */
  pauseOnHover?: boolean;
  /** Dither colour for the separator glyphs. */
  color?: PixelColor;
  /** Spacing between items in px. */
  gap?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * Bayer-ordered dither fill as an inline SVG data-URI tile (SSR-safe string
 * math). The separator glyph is a small rotated dithered square — a dithered
 * diamond — so the dividers read as part of the kit's texture.
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

/**
 * DitherTicker — auto-scrolling ticker tape with a seamless loop.
 *
 * Content is duplicated; a single rAF advances an offset (px/s × dt, direction
 * scaled) and writes `track.style.transform` directly — never React state, so
 * the loop costs zero re-renders. The wrap math is stable: when the offset
 * crosses one copy's width it wraps by that width, so the duplicated content
 * meets itself exactly with no seam jump. `useCanvasVisibility` gates the
 * loop — an off-screen ticker cancels its rAF and `wake()` resumes it on
 * re-entry, so it costs nothing while scrolled away. `pauseOnHover` halts on
 * pointer hover and keyboard focus.
 *
 * The loop math is deterministic (no randomness). `prefers-reduced-motion`
 * resolves in a mount effect and, when set, the loop never starts — the tape
 * is static (clipped) instead. Decorative by nature, so `role="region"` with
 * `aria-live="off"` rather than the deprecated `role="marquee"`.
 *
 * Dither language: the separator between items is a Bayer-dithered diamond via
 * {@link bayerFill}, matching the kit's scattered-pixel texture.
 */
export function DitherTicker({
  items,
  children,
  speed = 40,
  direction = "left",
  pauseOnHover = true,
  color = "blue",
  gap = 24,
  ariaLabel = "Ticker",
  className,
}: DitherTickerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const copyARef = useRef<HTMLDivElement | null>(null);
  const copyWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(speed);
  const dirRef = useRef(direction);
  const wakeRef = useRef<() => void>(() => {});

  speedRef.current = speed;
  dirRef.current = direction;

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);

  const handleWake = useCallback(() => wakeRef.current(), []);
  const visible = useCanvasVisibility(wrapRef, handleWake);

  useEffect(() => {
    if (reduced) return;
    let last = 0;

    function tick(now: number): void {
      rafRef.current = 0;
      if (!visible()) return; // off-screen: stop; wake() restarts on re-entry
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (!pausedRef.current && copyWidthRef.current > 0) {
        const dir = dirRef.current === "right" ? -1 : 1;
        offsetRef.current += speedRef.current * dt * dir;
        const w = copyWidthRef.current;
        if (offsetRef.current >= w) offsetRef.current -= w;
        else if (offsetRef.current < 0) offsetRef.current += w;
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function wake(): void {
      if (rafRef.current) return;
      last = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    wakeRef.current = wake;

    function measure(): void {
      if (copyARef.current) copyWidthRef.current = copyARef.current.scrollWidth;
    }
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (copyARef.current) ro?.observe(copyARef.current);

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      ro?.disconnect();
    };
    // `visible` is a stable getter over an internal ref; capturing it once is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  function renderCopy(): ReactNode {
    if (items) {
      return items.map((it, i) => (
        <span
          key={i}
          className="inline-flex shrink-0 items-center whitespace-nowrap"
          style={{ marginRight: gap }}
        >
          <span className="px-1 text-[13px] text-foreground/90">{it}</span>
          <span
            aria-hidden="true"
            className="inline-block size-2 rotate-45"
            style={bayerFill(color, 0.6)}
          />
        </span>
      ));
    }
    return children;
  }

  const setPause = (v: boolean): void => {
    if (pauseOnHover) pausedRef.current = v;
  };

  return (
    <div
      ref={wrapRef}
      role="region"
      aria-label={ariaLabel}
      aria-live="off"
      className={cn("overflow-hidden", className)}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={() => setPause(false)}
    >
      <div ref={trackRef} className="inline-flex w-max will-change-transform">
        <div ref={copyARef} className="inline-flex items-center">
          {renderCopy()}
        </div>
        <div className="inline-flex items-center" aria-hidden="true">
          {renderCopy()}
        </div>
      </div>
    </div>
  );
}
