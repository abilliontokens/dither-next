"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherMagnet.module.css";

export interface DitherMagnetProps {
  strength?: number;
  radius?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherMagnet — the wrapped content is pulled toward the cursor when the
 * pointer is within `radius` of the element's center, and springs back when it
 * leaves. A `pointermove` listener on `window` drives the transform on an
 * inner wrapper (CSS transition smooths the motion). Honors
 * `prefers-reduced-motion` (no listener attached).
 *
 * React port of Magnet.vue.
 */
export function DitherMagnet({
  strength = 0.4,
  radius = 200,
  className,
  children,
}: DitherMagnetProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pixelPrefersReducedMotion()) return;
    const onMove = (e: PointerEvent) => {
      const box = elRef.current?.getBoundingClientRect();
      const it = innerRef.current;
      if (!box || !it) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      if (Math.hypot(dx, dy) < radius) {
        it.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      } else {
        it.style.transform = "translate(0, 0)";
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [strength, radius]);

  return (
    <div ref={elRef} className={cn("inline-block", className)}>
      <div ref={innerRef} className={styles.inner}>
        {children}
      </div>
    </div>
  );
}
