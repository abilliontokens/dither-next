"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { mulberry32 } from "./dither-paint";
import styles from "./DitherTypeStream.module.css";

/** A per-character jitter (ms) derived from the seed so the stream develops
 * with organic pacing, not a metronome. */
function jitterFromSeed(seed: number): number[] {
  const rand = mulberry32(Math.round(seed) ^ 0x1f83d9ab);
  return Array.from({ length: 256 }, () => 0.4 + rand() * 0.8);
}

export interface DitherTypeStreamProps {
  text?: string;
  seed?: number;
  speed?: number;
  cursor?: boolean;
  className?: string;
}

/**
 * DitherTypeStream - a typewriter that streams `text` in character by
 * character with a dithered cursor block. Per-character timing is jittered
 * from `seed` via `mulberry32` so the pacing feels organic. Honors
 * `prefers-reduced-motion` by showing the full text immediately.
 *
 * React port of DitherTypeStream.vue. The stream state machine lives in a
 * single `useEffect` driven by `setTimeout`; the visible string and cursor
 * flag are state, while the timer id and char index are refs so the machine
 * advances without re-rendering. `displayedRef` mirrors the visible string so
 * the tick reads it synchronously without side effects inside setState
 * updaters (StrictMode-safe).
 */
export function DitherTypeStream({
  text = "",
  seed = 42,
  speed = 1,
  cursor = true,
  className,
}: DitherTypeStreamProps) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const displayedRef = useRef("");
  const iRef = useRef(0);
  const timerRef = useRef(0);

  const jitter = useMemo(() => jitterFromSeed(seed), [seed]);

  useEffect(() => {
    const reduced = pixelPrefersReducedMotion();

    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
    };

    const start = () => {
      clear();
      displayedRef.current = "";
      iRef.current = 0;
      setDisplayed("");
      setShowCursor(true);

      if (reduced) {
        displayedRef.current = text;
        setDisplayed(text);
        setShowCursor(false);
        return;
      }

      const chars = [...text];
      const tick = () => {
        if (iRef.current >= chars.length) {
          setShowCursor(cursor);
          return;
        }
        displayedRef.current += chars[iRef.current];
        setDisplayed(displayedRef.current);
        iRef.current++;
        const baseDelay = 28 / speed;
        const j = jitter[iRef.current % jitter.length];
        timerRef.current = window.setTimeout(tick, baseDelay * j);
      };
      timerRef.current = window.setTimeout(tick, 0);
    };

    start();

    return clear;
  }, [text, seed, speed, cursor, jitter]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      <span>{displayed}</span>
      {showCursor && (
        <span className={styles.cursor} aria-hidden="true" />
      )}
    </span>
  );
}
