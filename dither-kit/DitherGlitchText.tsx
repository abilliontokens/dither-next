"use client";

import { useMemo } from "react";

import { cn, sec } from "./lib";
import styles from "./DitherGlitchText.module.css";

/**
 * DitherGlitchText — RGB-split glitch. Two pseudo-element copies of the text
 * (magenta / cyan) are clipped and translated on a stepped loop, producing the
 * chromatic-aberration tear. `speed` scales the loop duration. Under
 * `prefers-reduced-motion: reduce` the copies are hidden (co-located CSS).
 */
export interface DitherGlitchTextProps {
  text?: string;
  speed?: number;
  className?: string;
}

export function DitherGlitchText({
  text = "GLITCH",
  speed = 1,
  className,
}: DitherGlitchTextProps) {
  const dur = useMemo(
    () => sec(Math.max(0.3, 2.5 / Math.max(0.01, speed))),
    [speed],
  );

  return (
    <span
      className={cn(styles.ditherGlitch, className)}
      data-text={text}
      style={{ "--dither-glitch-dur": dur } as React.CSSProperties}
    >
      {text}
    </span>
  );
}
