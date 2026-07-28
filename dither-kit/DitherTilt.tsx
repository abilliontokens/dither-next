"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent } from "react";

import { easingFromSeed } from "./dither-paint";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn } from "./lib";
import styles from "./DitherTilt.module.css";

/** Resolve a seeded easing to a CSS cubic-bezier string. */
function cssEasing(seed: number): string {
  const [x1, y1, x2, y2] = easingFromSeed(seed);
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

export interface DitherTiltProps {
  seed?: number;
  max?: number;
  scale?: number;
  perspective?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherTilt - 3D tilt-on-hover parallax. The card rotates toward/away from the
 * cursor, easing toward the target rotation each frame via RAF lerp, and lifts
 * with a slight scale while active. On leave it settles back to flat using a
 * seeded cubic-bezier transition. Honors prefers-reduced-motion (no tilt).
 *
 * React port of DitherTilt.vue. High-frequency rotation is written straight to
 * the element's transform (refs, not state) so pointer moves never re-render.
 */
export function DitherTilt({
  seed = 42,
  max = 12,
  scale = 1.02,
  perspective = 600,
  className,
  children,
}: DitherTiltProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const rotX = useRef(0);
  const rotY = useRef(0);
  const active = useRef(false);
  const raf = useRef(0);
  const targetRX = useRef(0);
  const targetRY = useRef(0);

  const easing = useMemo(() => cssEasing(seed), [seed]);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function applyTransform() {
    const el = elRef.current;
    if (!el) return;
    el.style.transform = `perspective(${perspective}px) rotateX(${rotX.current}deg) rotateY(${rotY.current}deg) scale(${active.current ? scale : 1})`;
    el.style.transition = active.current
      ? "none"
      : `transform 500ms ${easing}`;
  }

  function update() {
    rotX.current += (targetRX.current - rotX.current) * 0.12;
    rotY.current += (targetRY.current - rotY.current) * 0.12;
    applyTransform();
    if (
      Math.abs(targetRX.current - rotX.current) > 0.05 ||
      Math.abs(targetRY.current - rotY.current) > 0.05
    ) {
      raf.current = requestAnimationFrame(update);
    } else {
      raf.current = 0;
    }
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (pixelPrefersReducedMotion()) return;
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    // Tilt away from cursor: top of card tilts back when cursor is high.
    targetRY.current = (px - 0.5) * 2 * max;
    targetRX.current = -(py - 0.5) * 2 * max;
    active.current = true;
    applyTransform();
    if (!raf.current) raf.current = requestAnimationFrame(update);
  }

  function onLeave() {
    if (pixelPrefersReducedMotion()) return;
    targetRX.current = 0;
    targetRY.current = 0;
    active.current = false;
    applyTransform();
    if (!raf.current) raf.current = requestAnimationFrame(update);
  }

  return (
    <div
      ref={elRef}
      className={cn("dk-tilt inline-block", styles.tilt, className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}
