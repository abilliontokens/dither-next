"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherBlobCursorProps {
  color?: string;
  size?: number;
  lag?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherBlobCursor — a blurred blob follows the pointer with exponential lag
 * (easing toward the cursor each frame) and scales to 0 on leave. Driven by a
 * `requestAnimationFrame` loop; honors `prefers-reduced-motion` (no loop).
 *
 * React port of BlobCursor.vue.
 */
export function DitherBlobCursor({
  color = "#7CFF67",
  size = 48,
  lag = 0.18,
  className,
  children,
}: DitherBlobCursorProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  // Pointer + smoothed position held in refs (read by the RAF closure).
  const mRef = useRef({ x: 0, y: 0, active: false });
  const pRef = useRef({ x: 0, y: 0 });

  function onMove(e: React.PointerEvent) {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    mRef.current.x = e.clientX - r.left;
    mRef.current.y = e.clientY - r.top;
    mRef.current.active = true;
  }

  function onLeave() {
    mRef.current.active = false;
  }

  function frame() {
    rafRef.current = requestAnimationFrame(frame);
    const b = blobRef.current;
    if (!b) return;
    const m = mRef.current;
    const p = pRef.current;
    p.x += (m.x - p.x) * lag;
    p.y += (m.y - p.y) * lag;
    b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${m.active ? 1 : 0})`;
  }

  useEffect(() => {
    if (pixelPrefersReducedMotion()) return;
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [lag]);

  return (
    <div
      ref={areaRef}
      className={cn("relative overflow-hidden", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
      <div
        ref={blobRef}
        className="pointer-events-none absolute left-0 top-0 rounded-full blur-md"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: color,
          mixBlendMode: "screen",
          transform: "scale(0)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
