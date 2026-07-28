"use client";

import { useMemo } from "react";

import { cn, px } from "./lib";
import styles from "./DitherOrbitImages.module.css";

export interface DitherOrbitImagesProps {
  items?: string[];
  radius?: number;
  duration?: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherOrbitImages — items are placed evenly around a circle and the whole
 * ring rotates; each label counter-rotates so it stays upright. Pure CSS
 * animations; honors `prefers-reduced-motion`.
 *
 * React port of OrbitImages.vue.
 */
export function DitherOrbitImages({
  items = ["A", "B", "C", "D", "E"],
  radius = 80,
  duration = 16,
  size = 200,
  className,
  children,
}: DitherOrbitImagesProps) {
  const placed = useMemo(() => {
    const n = items.length || 1;
    return items.map((it, i) => {
      const a = (i / n) * Math.PI * 2;
      return { it, x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
    });
  }, [items, radius]);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <div
        className={cn(styles.orbit, "absolute inset-0")}
        style={{ animationDuration: `${duration}s` }}
      >
        {placed.map((p, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${px(p.x)}, ${px(p.y)})`,
            }}
          >
            <span
              className={styles.label}
              style={{ animationDuration: `${duration}s` }}
            >
              {p.it}
            </span>
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}
