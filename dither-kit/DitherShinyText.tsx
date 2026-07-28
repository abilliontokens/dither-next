"use client";

import { useMemo } from "react";

import { cn, sec } from "./lib";
import styles from "./DitherShinyText.module.css";

/**
 * DitherShinyText — a travelling highlight sweeps across translucent text.
 * `disabled` pauses the sweep; `speed` scales its duration. Under
 * `prefers-reduced-motion: reduce` the animation is dropped and the text is
 * shown at a flat translucent white (co-located CSS).
 */
export interface DitherShinyTextProps {
  speed?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DitherShinyText({
  speed = 1,
  disabled = false,
  className,
  children,
}: DitherShinyTextProps) {
  const dur = useMemo(
    () => sec(Math.max(0.4, 5 / Math.max(0.01, speed))),
    [speed],
  );

  return (
    <span
      className={cn(styles.ditherShinyText, className)}
      style={{
        animationDuration: dur,
        animationPlayState: disabled ? "paused" : "running",
      }}
    >
      {children}
    </span>
  );
}
