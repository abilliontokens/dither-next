"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "./lib";
import { colorToHex } from "./palette";
import {
  BAYER4,
  fillOf,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";

export interface DitherVirtualListProps<T> {
  items: T[];
  /** Fixed row height in px. */
  itemHeight: number;
  /** Container height in px. */
  height?: number;
  /** Extra rows rendered above/below the viewport. */
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
  /** Dither colour for the active row + scroll indicator. */
  color?: PixelColor;
  ariaLabel?: string;
  className?: string;
}

/**
 * Bayer-ordered dither fill as an inline SVG data-URI tile (SSR-safe string
 * math) — used for the active row + the scroll thumb.
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
    backgroundColor: `rgba(${r},${g},${b},0.1)`,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${4 * cell}px ${4 * cell}px`,
  };
}

/**
 * DitherVirtualList — windowed list for large datasets. Only the visible rows
 * (+ `overscan`) are mounted, absolutely positioned inside a tall spacer so
 * the native scrollbar reflects the real item count. A `ResizeObserver` feeds
 * the viewport height; `onScroll` feeds `scrollTop`, and both select the
 * render window from plain `useState` (no virtualization dependency).
 *
 * The container is the keyboard surface (`role="list"`, focusable): Arrow /
 * Home / End / PageUp / PageDown walk an active row, which is scrolled into
 * view and marked with a Bayer-dithered fill. A dithered scroll thumb on the
 * right edge (native bar hidden) shows position — decorative, `aria-hidden`.
 * `prefers-reduced-motion` snaps scroll-into-view to instant.
 *
 * Dither language: the active row and the thumb are ordered-dither tiles via
 * {@link bayerFill}, not solid colour, so the selection reads as part of the
 * kit's texture.
 */
export function DitherVirtualList<T>({
  items,
  itemHeight,
  height = 320,
  overscan = 4,
  renderItem,
  getKey,
  color = "blue",
  ariaLabel = "List",
  className,
}: DitherVirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  // Viewport height drives the render window; observe it (mount + resize).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    function measure(): void {
      if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = items.length * itemHeight;
  const active = items.length === 0 ? -1 : Math.min(Math.max(0, activeIndex), items.length - 1);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (items.length === 0) return;
    const pageSize = Math.max(1, Math.floor(viewportHeight / itemHeight));
    let next = active;
    if (e.key === "ArrowDown") next = active + 1;
    else if (e.key === "ArrowUp") next = active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "PageDown") next = active + pageSize;
    else if (e.key === "PageUp") next = active - pageSize;
    else return;
    e.preventDefault();
    const clamped = Math.min(items.length - 1, Math.max(0, next));
    setActiveIndex(clamped);
    const el = containerRef.current;
    if (!el) return;
    const top = clamped * itemHeight;
    const behavior: ScrollBehavior = still ? "auto" : "smooth";
    if (top < el.scrollTop) el.scrollTo({ top, behavior });
    else if (top + itemHeight > el.scrollTop + viewportHeight)
      el.scrollTo({ top: top + itemHeight - viewportHeight, behavior });
  }

  const activeStyle = bayerFill(color, 0.5);
  const showThumb = viewportHeight > 0 && total > viewportHeight;
  const thumbTop = total > 0 ? (scrollTop / total) * 100 : 0;
  const thumbSize = total > 0 ? Math.max(8, (viewportHeight / total) * 100) : 100;

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <div
        ref={containerRef}
        role="list"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        )}
      >
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-muted-foreground/60">
            No items.
          </div>
        ) : (
          <div style={{ height: total, position: "relative" }}>
            {items.slice(start, end).map((item, i) => {
              const idx = start + i;
              const isActive = idx === active;
              return (
                <div
                  key={getKey ? getKey(item, idx) : idx}
                  role="listitem"
                  aria-current={isActive ? "true" : undefined}
                  style={{
                    position: "absolute",
                    top: idx * itemHeight,
                    height: itemHeight,
                    left: 0,
                    right: 0,
                    ...(isActive ? activeStyle : undefined),
                  }}
                  className={cn(
                    "flex items-center px-3",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {renderItem(item, idx)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showThumb ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 right-1 top-1 w-1 rounded-full bg-border/30"
        >
          <div
            className="w-full rounded-full"
            style={{
              position: "absolute",
              top: `${thumbTop}%`,
              height: `${thumbSize}%`,
              ...bayerFill(color, 0.6),
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
