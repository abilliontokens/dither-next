"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherTextType.module.css";

export interface DitherTextTypeProps {
  texts?: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pause?: number;
  loop?: boolean;
  cursor?: boolean;
  className?: string;
}

/**
 * DitherTextType — a typewriter that types and deletes through `texts`,
 * optionally looping. Honors `prefers-reduced-motion` by showing the first
 * text immediately.
 *
 * React port of TextType.vue. The type/delete state machine lives in a single
 * `useEffect` driven by `setTimeout`; `ti` and the timer id are refs so the
 * machine advances without re-rendering. `shownRef` mirrors the visible
 * string so the machine reads it synchronously without side effects inside
 * setState updaters (StrictMode-safe).
 */
export function DitherTextType({
  texts = ["Type this out.", "Then this."],
  typingSpeed = 60,
  deletingSpeed = 35,
  pause = 1400,
  loop = true,
  cursor = true,
  className,
}: DitherTextTypeProps) {
  const [shown, setShown] = useState("");
  const shownRef = useRef("");
  const tiRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const list = texts.length ? texts : [""];

    const type = () => {
      const full = list[tiRef.current % list.length];
      const cur = shownRef.current;
      if (cur.length < full.length) {
        const next = full.slice(0, cur.length + 1);
        shownRef.current = next;
        setShown(next);
        timerRef.current = window.setTimeout(type, Math.max(0, typingSpeed));
      } else if (loop || tiRef.current < list.length - 1) {
        timerRef.current = window.setTimeout(del, Math.max(0, pause));
      }
    };

    const del = () => {
      const cur = shownRef.current;
      if (cur.length > 0) {
        const next = cur.slice(0, -1);
        shownRef.current = next;
        setShown(next);
        timerRef.current = window.setTimeout(del, Math.max(0, deletingSpeed));
      } else {
        tiRef.current++;
        timerRef.current = window.setTimeout(type, Math.max(0, 220));
      }
    };

    if (pixelPrefersReducedMotion()) {
      shownRef.current = list[0];
      setShown(list[0]);
      return;
    }
    timerRef.current = window.setTimeout(type, Math.max(0, 300));

    return () => clearTimeout(timerRef.current);
  }, [texts, typingSpeed, deletingSpeed, pause, loop]);

  return (
    <span className={cn("inline-block whitespace-pre", className)}>
      <span>{shown}</span>
      {cursor && (
        <span className={styles.ditherCaret} aria-hidden="true">
          |
        </span>
      )}
    </span>
  );
}
