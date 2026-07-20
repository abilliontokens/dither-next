"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherTrueFocusProps {
  text?: string;
  interval?: number;
  blur?: number;
  className?: string;
}

/**
 * DitherTrueFocus — words cycle through a sharp "active" state while the rest
 * stay blurred and dimmed, advancing on a timer. Honors `prefers-reduced-
 * motion` (no cycling) and skips the timer when there are fewer than two
 * words.
 *
 * React port of TrueFocus.vue.
 */
export function DitherTrueFocus({
  text = "True focus mode",
  interval = 1400,
  blur = 5,
  className,
}: DitherTrueFocusProps) {
  const words = useMemo(
    () => text.split(/\s+/).filter(Boolean),
    [text],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (pixelPrefersReducedMotion() || words.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((a) => (a + 1) % words.length);
    }, Math.max(300, interval));
    return () => clearInterval(timer);
  }, [words, interval]);

  return (
    <span
      className={cn("inline-flex flex-wrap gap-x-[0.35em] gap-y-1", className)}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="dither-focus-word inline-block transition-[filter,opacity] duration-500"
          style={{
            filter: i === active ? "blur(0)" : `blur(${blur}px)`,
            opacity: i === active ? 1 : 0.5,
          }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}
