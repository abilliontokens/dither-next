"use client";

import { useMemo } from "react";

import { cn } from "./lib";
import styles from "./DitherStarBorder.module.css";

export interface DitherStarBorderProps {
  color?: string;
  speed?: number;
  thickness?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherStarBorder — a CSS-animated border: two radial-gradient glints sweep
 * along opposite edges, clipped by the rounded overflow-hidden container.
 * Pure CSS animation; honors `prefers-reduced-motion`.
 *
 * React port of StarBorder.vue.
 */
export function DitherStarBorder({
  color = "#7CFF67",
  speed = 6,
  thickness = 1,
  className,
  children,
}: DitherStarBorderProps) {
  const glint = useMemo(
    () => `radial-gradient(circle, ${color}, transparent 12%)`,
    [color],
  );

  return (
    <div
      className={cn(
        "relative inline-block overflow-hidden rounded-[14px]",
        className,
      )}
      style={{ padding: `${thickness}px` }}
    >
      <span
        className={cn(styles.strip, styles.bottom)}
        style={{ background: glint, animationDuration: `${speed}s` }}
        aria-hidden="true"
      />
      <span
        className={cn(styles.strip, styles.top)}
        style={{ background: glint, animationDuration: `${speed}s` }}
        aria-hidden="true"
      />
      <div className="relative z-[1] rounded-[13px] bg-background px-4 py-2">
        {children}
      </div>
    </div>
  );
}
