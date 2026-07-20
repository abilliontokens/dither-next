"use client";

import { useMemo } from "react";

import { cn } from "./lib";
import styles from "./DitherFallingText.module.css";

export interface DitherFallingTextProps {
  text?: string;
  stagger?: number;
  duration?: number;
  replayToken?: number;
  className?: string;
}

/**
 * DitherFallingText — each character drops in from above with a slight
 * counter-rotation and a per-character stagger, settling with an overshoot
 * easing. Pure CSS animation; honors `prefers-reduced-motion`.
 *
 * React port of FallingText.vue.
 */
export function DitherFallingText({
  text = "Falling text",
  stagger = 45,
  duration = 700,
  replayToken = 0,
  className,
}: DitherFallingTextProps) {
  const chars = useMemo(() => [...text], [text]);
  const runKey = useMemo(
    () => `${text}-${replayToken ?? 0}`,
    [text, replayToken],
  );

  return (
    <span
      key={runKey}
      className={cn("inline-block", className)}
      aria-label={text}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={styles.ditherFallChar}
          style={{
            animationDelay: `${i * stagger}ms`,
            animationDuration: `${duration}ms`,
          }}
        >
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </span>
  );
}
