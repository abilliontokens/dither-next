"use client";

import { useMemo } from "react";

import { cn } from "./lib";
import styles from "./DitherLogoLoop.module.css";

export interface DitherLogoLoopProps {
  items?: string[];
  speed?: number;
  gap?: number;
  className?: string;
}

/**
 * DitherLogoLoop — a seamless horizontal marquee: `items` are duplicated once
 * so a `translateX(-50%)` animation wraps without a visible seam. Pure CSS
 * animation; honors `prefers-reduced-motion`.
 *
 * React port of LogoLoop.vue.
 */
export function DitherLogoLoop({
  items = ["DITHER", "BAYER", "CANVAS", "VUE", "PIXELS"],
  speed = 18,
  gap = 48,
  className,
}: DitherLogoLoopProps) {
  // Duplicated once so translateX(-50%) wraps seamlessly.
  const loop = useMemo(() => [...items, ...items], [items]);

  return (
    <div className={cn("overflow-hidden", className)} aria-hidden="true">
      <div
        className={cn(styles.loop, "flex w-max")}
        style={{ animationDuration: `${speed}s` }}
      >
        {loop.map((it, i) => (
          <span
            key={i}
            className="shrink-0 whitespace-nowrap"
            style={{ paddingRight: `${gap}px` }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
