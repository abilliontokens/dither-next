"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherFadeContent.module.css";

export interface DitherFadeContentProps {
  duration?: number;
  delay?: number;
  blur?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherFadeContent — fades content in (optionally with a blur) when it
 * scrolls into view (IntersectionObserver, one-shot). Honors
 * `prefers-reduced-motion` by showing immediately.
 *
 * React port of FadeContent.vue.
 */
export function DitherFadeContent({
  duration = 1000,
  delay = 0,
  blur = false,
  className,
  children,
}: DitherFadeContentProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (pixelPrefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const node = elRef.current;
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
    <div
      ref={elRef}
      className={cn(styles.content, className)}
      style={{
        opacity: shown ? 1 : 0,
        filter: blur && !shown ? "blur(10px)" : "blur(0)",
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
