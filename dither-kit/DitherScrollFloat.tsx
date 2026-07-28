"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn, em, round } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherScrollFloat.module.css";

export interface DitherScrollFloatProps {
  text?: string;
  amount?: number;
  className?: string;
}

export function DitherScrollFloat({
  text = "Scroll float",
  amount = 1,
  className,
}: DitherScrollFloatProps) {
  const chars = useMemo(() => [...text], [text]);
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

  const floatStyle = (i: number) => {
    const t = Math.max(0, Math.min(1, progress * chars.length - i * 0.5));
    return {
      opacity: round(0.15 + 0.85 * t, 4),
      transform: `translateY(${em((1 - t) * 0.7 * amount)})`,
    };
  };

  return (
    <span ref={el} className={cn("inline-block", className)} aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={styles.ditherFloatChar}
          style={floatStyle(i)}
        >
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </span>
  );
}
