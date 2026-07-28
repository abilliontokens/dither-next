"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent } from "react";

import { easingFromSeed } from "./dither-paint";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn } from "./lib";
import styles from "./DitherMagnetic.module.css";

/** Resolve a seeded easing to a CSS cubic-bezier string for the magnetic
 * settle transition. */
function cssEasing(seed: number): string {
  const [x1, y1, x2, y2] = easingFromSeed(seed);
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

export interface DitherMagneticProps {
  seed?: number;
  strength?: number;
  radius?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherMagnetic - magnetic pull on hover. The wrapped content drifts toward
 * the cursor when the pointer is within `radius` of the element's center, with
 * strength falling off by distance so the pull is strongest up close. It eases
 * toward the target offset each frame via RAF lerp, and settles back to rest
 * using a seeded cubic-bezier transition when the pointer leaves. Honors
 * prefers-reduced-motion (no drift).
 *
 * React port of DitherMagnetic.vue. High-frequency translation is written
 * straight to the element's transform (refs, not state) so pointer moves never
 * re-render.
 */
export function DitherMagnetic({
  seed = 42,
  strength = 0.3,
  radius = 150,
  className,
  children,
}: DitherMagneticProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dx = useRef(0);
  const dy = useRef(0);
  const active = useRef(false);
  const raf = useRef(0);
  const targetDx = useRef(0);
  const targetDy = useRef(0);

  const easing = useMemo(() => cssEasing(seed), [seed]);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function applyTransform() {
    const el = elRef.current;
    if (!el) return;
    el.style.transform = `translate(${dx.current}px, ${dy.current}px)`;
    el.style.transition = active.current
      ? "none"
      : `transform 400ms ${easing}`;
  }

  function update() {
    // Lerp toward target for smooth magnetic pull.
    dx.current += (targetDx.current - dx.current) * 0.18;
    dy.current += (targetDy.current - dy.current) * 0.18;
    applyTransform();
    if (
      Math.abs(targetDx.current - dx.current) > 0.3 ||
      Math.abs(targetDy.current - dy.current) > 0.3
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
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const distX = e.clientX - cx;
    const distY = e.clientY - cy;
    const dist = Math.hypot(distX, distY);
    if (dist > radius) {
      targetDx.current = 0;
      targetDy.current = 0;
      active.current = false;
    } else {
      // Strength falls off with distance so the pull is strongest up close.
      const falloff = 1 - dist / radius;
      targetDx.current = distX * strength * falloff;
      targetDy.current = distY * strength * falloff;
      active.current = true;
    }
    applyTransform();
    if (!raf.current) raf.current = requestAnimationFrame(update);
  }

  function onLeave() {
    if (pixelPrefersReducedMotion()) return;
    targetDx.current = 0;
    targetDy.current = 0;
    active.current = false;
    applyTransform();
    if (!raf.current) raf.current = requestAnimationFrame(update);
  }

  return (
    <div
      ref={elRef}
      className={cn("dk-magnetic inline-block", styles.magnetic, className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}
