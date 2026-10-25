"use client";

import { useEffect, useRef, useState, type ElementType, type HTMLAttributes } from "react";

import { cn } from "./lib";

/** Truncation with the tooltip attached only when it earns it: observes its
 * own overflow (ResizeObserver, no forced reads) and — clipped — publishes the
 * full text content as `title`. Unclipped content gets no tooltip at all,
 * which is the point. Degraded engines just render the text.
 * Port of EllipsisTooltip.vue. */
export interface DitherEllipsisTooltipProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: ElementType;
  enabled?: boolean;
  className?: string;
}

export function DitherEllipsisTooltip({
  as: Tag = "span",
  enabled = true,
  className,
  children,
  ...rest
}: DitherEllipsisTooltipProps) {
  const root = useRef<HTMLElement | null>(null);
  const [clipped, setClipped] = useState(false);
  const [full, setFull] = useState("");

  // Measure on mount + every resize; one effect owns the observer lifecycle.
  useEffect(() => {
    const measure = () => {
      const el = root.current;
      if (!el || !enabled) {
        setClipped(false);
        return;
      }
      setFull((el.textContent || "").trim());
      setClipped(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const el = root.current;
    if (typeof ResizeObserver === "undefined" || !el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled, Tag]);

  return (
    <Tag {...rest} ref={root} title={clipped ? full : undefined} className={cn("block truncate", className)}>
      {children}
    </Tag>
  );
}

export default DitherEllipsisTooltip;
