"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn, em, px, round } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherScrollReveal.module.css";

export interface DitherScrollRevealProps {
  text?: string;
  className?: string;
}

export function DitherScrollReveal({
  text = "Words reveal as you scroll into view",
  className,
}: DitherScrollRevealProps) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const el = useRef<HTMLSpanElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (pixelPrefersReducedMotion()) {
      setProgress(1);
      return;
    }
    const update = () => {
      const node = el.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      setProgress(
        Math.max(0, Math.min(1, 1 - (r.top - vh * 0.2) / (vh * 0.55))),
      );
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const reveal = (i: number) =>
    Math.max(0.06, Math.min(1, progress * words.length - i));

  return (
    <span ref={el} className={cn("inline-block", className)} aria-label={text}>
      {words.map((w, i) => {
        const t = reveal(i);
        return (
          <span
            key={i}
            aria-hidden="true"
            className={styles.ditherRevealWord}
            style={{
              opacity: round(t, 4),
              filter: `blur(${px((1 - t) * 4)})`,
              transform: `translateY(${em((1 - t) * 0.3)})`,
            }}
          >
            {/^\s*$/.test(w) ? "\u00a0" : w}
          </span>
        );
      })}
    </span>
  );
}
