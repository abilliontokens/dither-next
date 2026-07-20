"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherCountUpProps {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  className?: string;
}

/**
 * DitherCountUp — animates a number from `from` to `to` with an ease-out-cubic
 * curve, starting when the element scrolls into view (IntersectionObserver,
 * one-shot). Honors `prefers-reduced-motion` by jumping straight to `to`.
 *
 * React port of CountUp.vue.
 */
export function DitherCountUp({
  to,
  from = 0,
  duration = 1500,
  decimals = 0,
  className,
}: DitherCountUpProps) {
  const elRef = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(from);

  // Mutable loop/observer state — must not trigger re-renders.
  const rafRef = useRef(0);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (pixelPrefersReducedMotion()) {
        setValue(to);
        return;
      }
      const t0 = performance.now();
      const d = Math.max(1, duration);
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / d);
        const e = 1 - Math.pow(1 - p, 3);
        setValue(from + (to - from) * e);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return;
    }
    const node = elRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) run();
    });
    ioRef.current = io;
    io.observe(node);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      io.disconnect();
    };
  }, [to, from, duration]);

  const display = useMemo(
    () =>
      value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [value, decimals]
  );

  return (
    <span ref={elRef} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}
