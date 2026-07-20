"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherBlurText.module.css";

export interface DitherBlurTextProps {
  text?: string;
  by?: "words" | "chars";
  stagger?: number;
  duration?: number;
  className?: string;
}

/**
 * DitherBlurText — words (or characters) blur and lift into focus once the
 * element scrolls into view, staggered by index. Uses an IntersectionObserver
 * to trigger once; honors `prefers-reduced-motion` (shows immediately).
 *
 * React port of BlurText.vue.
 */
export function DitherBlurText({
  text = "Blur into focus",
  by = "words",
  stagger = 90,
  duration = 600,
  className,
}: DitherBlurTextProps) {
  const parts = useMemo(
    () => (by === "chars" ? [...text] : text.split(/(\s+)/)),
    [text, by],
  );
  const el = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (pixelPrefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShown(true);
        io.disconnect();
      }
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={el}
      className={cn("inline-block", className)}
      aria-label={text}
    >
      {parts.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(styles.ditherBlurPart, shown && styles.shown)}
          style={{
            transitionDelay: `${i * stagger}ms`,
            transitionDuration: `${duration}ms`,
          }}
        >
          {/^\s*$/.test(p) ? "\u00a0" : p}
        </span>
      ))}
    </span>
  );
}
