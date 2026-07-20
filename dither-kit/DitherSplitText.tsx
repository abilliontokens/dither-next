"use client";

import { useMemo } from "react";

import { cn } from "./lib";
import styles from "./DitherSplitText.module.css";

export interface DitherSplitTextProps {
  text?: string;
  stagger?: number;
  duration?: number;
  replayToken?: number;
  className?: string;
}

/**
 * DitherSplitText — each character rises and un-rotates into place with a
 * per-character stagger. Pure CSS animation; honors `prefers-reduced-motion`.
 *
 * React port of SplitText.vue.
 */
export function DitherSplitText({
  text = "Split text",
  stagger = 40,
  duration = 600,
  replayToken = 0,
  className,
}: DitherSplitTextProps) {
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
          className={styles.ditherSplitChar}
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
