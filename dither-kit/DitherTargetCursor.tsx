"use client";

import { useRef, useState } from "react";

import { cn } from "./lib";
import styles from "./DitherTargetCursor.module.css";

export interface DitherTargetCursorProps {
  color?: string;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherTargetCursor — a spinning corner-bracket reticle that tracks the
 * pointer within the area, fading out on leave. Position is written to state
 * on each `pointermove`; the spin is a pure CSS animation. Honors
 * `prefers-reduced-motion` (spin frozen).
 *
 * React port of TargetCursor.vue.
 */
export function DitherTargetCursor({
  color = "#7CFF67",
  size = 36,
  className,
  children,
}: DitherTargetCursorProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(-99);
  const [y, setY] = useState(-99);
  const [on, setOn] = useState(false);

  function onMove(e: React.PointerEvent) {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    setX(e.clientX - r.left);
    setY(e.clientY - r.top);
    setOn(true);
  }

  return (
    <div
      ref={areaRef}
      className={cn("relative overflow-hidden", className)}
      onPointerMove={onMove}
      onPointerLeave={() => setOn(false)}
    >
      {children}
      <div
        className={cn(styles.target, "pointer-events-none absolute left-0 top-0")}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
          opacity: on ? 1 : 0,
          color,
        }}
        aria-hidden="true"
      >
        <span className={cn(styles.corner, styles.tl)} />
        <span className={cn(styles.corner, styles.tr)} />
        <span className={cn(styles.corner, styles.bl)} />
        <span className={cn(styles.corner, styles.br)} />
      </div>
    </div>
  );
}
