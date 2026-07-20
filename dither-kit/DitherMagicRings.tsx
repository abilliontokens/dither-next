"use client";

import { useMemo } from "react";

import { cn } from "./lib";
import styles from "./DitherMagicRings.module.css";

export interface DitherMagicRingsProps {
  color?: string;
  count?: number;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherMagicRings — concentric rings expand outward and fade, staggered by a
 * negative `animationDelay` so they pulse in waves. Pure CSS animation; honors
 * `prefers-reduced-motion`.
 *
 * React port of MagicRings.vue.
 */
export function DitherMagicRings({
  color = "#7CFF67",
  count = 4,
  duration = 3,
  className,
  children,
}: DitherMagicRingsProps) {
  const rings = useMemo(() => Math.max(1, Math.round(count)), [count]);

  return (
    <div className={cn("relative grid place-items-center overflow-hidden", className)}>
      {children}
      {Array.from({ length: rings }, (_, i) => (
        <span
          key={i}
          className={cn(styles.ring, "pointer-events-none absolute rounded-full")}
          style={{
            borderColor: color,
            animationDuration: `${duration}s`,
            animationDelay: `${-((i) * duration) / rings}s`,
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
