"use client";

import { useMemo } from "react";

import { cn, sec } from "./lib";
import styles from "./DitherGradientText.module.css";

/**
 * DitherGradientText — animated gradient text. The gradient sweeps across the
 * glyphs on an infinite linear loop; `speed` scales the sweep duration.
 * `prefers-reduced-motion: reduce` disables the animation (co-located CSS).
 */
export interface DitherGradientTextProps {
  colors?: string[];
  speed?: number;
  className?: string;
  children?: React.ReactNode;
}

export function DitherGradientText({
  colors = ["#358ff3", "#7CFF67", "#358ff3"],
  speed = 1,
  className,
  children,
}: DitherGradientTextProps) {
  const bg = useMemo(
    () =>
      `linear-gradient(90deg, ${(colors.length ? colors : ["#ffffff"]).join(", ")})`,
    [colors],
  );
  const dur = useMemo(
    () => sec(Math.max(0.2, 6 / Math.max(0.01, speed))),
    [speed],
  );

  return (
    <span
      className={cn(styles.ditherGradientText, className)}
      style={{ backgroundImage: bg, animationDuration: dur }}
    >
      {children}
    </span>
  );
}
