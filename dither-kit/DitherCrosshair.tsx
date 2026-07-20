"use client";

import { useRef, useState } from "react";

import { cn } from "./lib";

export interface DitherCrosshairProps {
  color?: string;
  thickness?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherCrosshair — full-width vertical + full-height horizontal lines that
 * track the pointer within the area, fading out on leave. No RAF: position is
 * written to state on each `pointermove` (cheap; two divs re-render).
 *
 * React port of Crosshair.vue.
 */
export function DitherCrosshair({
  color = "#7CFF67",
  thickness = 1,
  className,
  children,
}: DitherCrosshairProps) {
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
        className="pointer-events-none absolute inset-y-0"
        style={{
          left: `${x}px`,
          width: `${thickness}px`,
          background: color,
          opacity: on ? 0.8 : 0,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: `${y}px`,
          height: `${thickness}px`,
          background: color,
          opacity: on ? 0.8 : 0,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
