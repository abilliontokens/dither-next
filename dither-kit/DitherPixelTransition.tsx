"use client";

import { useMemo } from "react";

import { cn, ms } from "./lib";
import styles from "./DitherPixelTransition.module.css";

export interface DitherPixelTransitionProps {
  rows?: number;
  cols?: number;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherPixelTransition — a grid of cells overlays the content; on hover each
 * cell fades out with a deterministic per-cell delay (seeded by index) so the
 * dissolve order is stable and organic. Pure CSS transition; honors
 * `prefers-reduced-motion`.
 *
 * React port of PixelTransition.vue.
 */
export function DitherPixelTransition({
  rows = 6,
  cols = 10,
  color = "#111318",
  className,
  children,
}: DitherPixelTransitionProps) {
  const cells = useMemo(() => {
    // Deterministic per-cell delay so the dissolve order is stable.
    const seeded = (i: number) => {
      const s = Math.sin(i * 43.21) * 1000;
      return s - Math.floor(s);
    };
    return Array.from(
      { length: Math.max(1, rows * cols) },
      (_, i) => seeded(i) * 300,
    );
  }, [rows, cols]);

  return (
    <div className={cn(styles.wrap, "group relative overflow-hidden", className)}>
      {children}
      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
        aria-hidden="true"
      >
        {cells.map((delay, i) => (
          <span
            key={i}
            className={styles.cell}
            style={{ background: color, transitionDelay: ms(delay) }}
          />
        ))}
      </div>
    </div>
  );
}
