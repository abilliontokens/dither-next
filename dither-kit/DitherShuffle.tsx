"use client";

import { useMemo } from "react";

import { cn, deg, em } from "./lib";
import styles from "./DitherShuffle.module.css";

export interface DitherShuffleProps {
  text?: string;
  stagger?: number;
  duration?: number;
  replayToken?: number;
  className?: string;
}

/** Deterministic pseudo-random in [0, 1) — same seed always yields the same
 * offset, so a given text shuffles identically on every render. */
function seeded(i: number, salt: number) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * DitherShuffle — each character flies in from a seeded random offset
 * (translate + rotate) with a per-character stagger. Pure CSS animation;
 * honors `prefers-reduced-motion`.
 *
 * React port of Shuffle.vue.
 */
export function DitherShuffle({
  text = "Shuffle in",
  stagger = 55,
  duration = 650,
  replayToken = 0,
  className,
}: DitherShuffleProps) {
  const chars = useMemo(
    () =>
      [...text].map((ch, i) => ({
        ch: ch === " " ? "\u00a0" : ch,
        dx: (seeded(i, 1) - 0.5) * 2,
        dy: (seeded(i, 2) - 0.5) * 1.4,
        rot: (seeded(i, 3) - 0.5) * 40,
      })),
    [text],
  );
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
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={styles.ditherShuffleChar}
          style={
            {
              animationDelay: `${i * stagger}ms`,
              animationDuration: `${duration}ms`,
              "--dx": em(c.dx),
              "--dy": em(c.dy),
              "--rot": deg(c.rot),
            } as React.CSSProperties
          }
        >
          {c.ch}
        </span>
      ))}
    </span>
  );
}
