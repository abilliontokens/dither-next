"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherAnimatedContent.module.css";

export interface DitherAnimatedContentProps {
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherAnimatedContent — reveals content by sliding + fading in when it
 * scrolls into view (IntersectionObserver, one-shot). Honors
 * `prefers-reduced-motion` by showing immediately.
 *
 * React port of AnimatedContent.vue.
 */
export function DitherAnimatedContent({
  distance = 40,
  direction = "vertical",
  reverse = false,
  duration = 800,
  delay = 0,
  className,
  children,
}: DitherAnimatedContentProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  const hidden = useMemo(() => {
    const d = distance * (reverse ? -1 : 1);
    return direction === "horizontal" ? `translateX(${d}px)` : `translateY(${d}px)`;
  }, [distance, direction, reverse]);

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
        transform: shown ? "none" : hidden,
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
