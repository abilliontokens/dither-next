"use client";

import { cn } from "./lib";
import styles from "./DitherGlareHover.module.css";

export interface DitherGlareHoverProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherGlareHover — a full-cover diagonal shine that sweeps across on hover;
 * the parent's overflow-hidden clips it, so the stripe reads as a single
 * glare pass. Pure CSS transition; honors `prefers-reduced-motion`.
 *
 * React port of GlareHover.vue.
 */
export function DitherGlareHover({ className, children }: DitherGlareHoverProps) {
  return (
    <div
      className={cn(
        "group relative inline-block overflow-hidden rounded-[12px]",
        className,
      )}
    >
      {children}
      <div className={cn(styles.glare, "pointer-events-none absolute inset-0")} aria-hidden="true" />
    </div>
  );
}
