import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cn } from "./lib";

/**
 * DitherGrid — dashboard grid: auto-fit card columns by minimum width, or a
 * fixed column count. Children span with plain col-span utilities.
 *
 * Port of DitherGrid.vue. Pure render (style derived in render, no state), so
 * it stays a Server Component (no `"use client"`). Unknown attrs fall through
 * to the grid element like the Vue root's; a passed `style` merges last.
 */
export interface DitherGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Minimum card width; columns auto-fit. Ignored when cols is set. */
  min?: number;
  /** Fixed column count — for deliberate layouts. */
  cols?: number;
  /** Grid gap, any CSS length. */
  gap?: string;
  className?: string;
  children?: ReactNode;
}

export function DitherGrid({
  min = 240,
  cols,
  gap = "0.75rem",
  className,
  style,
  children,
  ...rest
}: DitherGridProps) {
  const grid: CSSProperties = {
    gridTemplateColumns: cols
      ? `repeat(${cols}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
    gap,
  };
  return (
    <div {...rest} className={cn("grid", className)} style={{ ...grid, ...style }}>
      {children}
    </div>
  );
}

export default DitherGrid;
