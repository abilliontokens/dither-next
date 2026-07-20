"use client";

import { useId } from "react";

import { cn } from "./lib";
import styles from "./DitherCircularText.module.css";

/**
 * DitherCircularText — text laid out along a circular SVG path, rotating as a
 * whole on an infinite linear loop. `duration` scales the rotation period.
 * Under `prefers-reduced-motion: reduce` the rotation is disabled (co-located
 * CSS). `useId` keeps the path id SSR-stable and unique per instance.
 */
export interface DitherCircularTextProps {
  text?: string;
  duration?: number;
  size?: number;
  className?: string;
}

export function DitherCircularText({
  text = "DITHER · UI · TOOLKIT · ",
  duration = 12,
  size = 170,
  className,
}: DitherCircularTextProps) {
  const rawId = useId();
  const uid = "dither-circle-" + rawId.replace(/:/g, "");
  const R = 40;
  const d = `M 50 50 m -${R} 0 a ${R} ${R} 0 1 1 ${R * 2} 0 a ${R} ${R} 0 1 1 -${R * 2} 0`;

  return (
    <div
      className={cn("inline-grid place-items-center", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label={text}
    >
      <svg
        viewBox="0 0 100 100"
        className={cn(styles.ditherCircularSvg, "h-full w-full")}
        style={{ animationDuration: `${duration}s` }}
        aria-hidden="true"
      >
        <defs>
          <path id={uid} d={d} fill="none" />
        </defs>
        <text className={styles.ditherCircularText}>
          <textPath href={`#${uid}`} startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
