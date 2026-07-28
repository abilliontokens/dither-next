"use client";

import { useEffect, useMemo, useRef } from "react";

import { mulberry32 } from "./dither-paint";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn } from "./lib";
import styles from "./DitherSpotlight.module.css";

/** Seeded spotlight radius and falloff. One integer yields a tight beam or
 * a wide wash; the falloff curve stays readable for every seed. */
function spotlightFromSeed(seed: number) {
  const rand = mulberry32(Math.round(seed) ^ 0x2c1b3c6d);
  return {
    radius: 120 + rand() * 180,
    falloff: 0.3 + rand() * 0.4,
    dim: 0.15 + rand() * 0.2,
  };
}

export interface DitherSpotlightProps {
  seed?: number;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherSpotlight - a cursor-following spotlight that dims outside its cone
 * and casts a faint glow at the pointer. Radius, falloff, and dim strength
 * are derived from `seed` (via mulberry32) so each instance has a distinct
 * beam shape. The cone tracks the pointer with a RAF-driven lerp for smooth
 * motion without an animation dependency. Honors `prefers-reduced-motion`
 * (no tracking, no dim) and `prefers-reduced-transparency` (overlay hidden).
 *
 * React port of DitherSpotlight.vue.
 */
export function DitherSpotlight({
  seed = 42,
  color = "var(--foreground)",
  className,
  children,
}: DitherSpotlightProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  // Pointer-tracked position lives in refs so RAF writes don't re-render; the
  // CSS custom properties are applied directly to the element via the style
  // ref, mirroring the Vue version's `style` computed + reactive x/y.
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const rafRef = useRef(0);
  const reducedRef = useRef(false);
  const startedRef = useRef(false);

  const spot = useMemo(() => spotlightFromSeed(seed), [seed]);

  // The overlay/glow CSS vars are written imperatively from the RAF loop so
  // they update every frame without a React re-render.
  const dimRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  function writeVars() {
    const { x, y } = posRef.current;
    const r = spot.radius;
    const dim = activeRef.current ? spot.dim : 1;
    if (dimRef.current) {
      dimRef.current.style.background = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,${dim}) 100%)`;
    }
    if (glowRef.current) {
      glowRef.current.style.background = activeRef.current
        ? `radial-gradient(circle ${r * 0.4}px at ${x}px ${y}px, ${color}22 0%, transparent 70%)`
        : "none";
    }
  }

  function update() {
    const pos = posRef.current;
    const target = targetRef.current;
    pos.x += (target.x - pos.x) * 0.15;
    pos.y += (target.y - pos.y) * 0.15;
    writeVars();
    if (Math.abs(target.x - pos.x) > 0.5 || Math.abs(target.y - pos.y) > 0.5) {
      rafRef.current = requestAnimationFrame(update);
    } else {
      rafRef.current = 0;
      pos.x = target.x;
      pos.y = target.y;
      writeVars();
    }
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!elRef.current || reducedRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    targetRef.current.x = e.clientX - rect.left;
    targetRef.current.y = e.clientY - rect.top;
    activeRef.current = true;
    if (!rafRef.current) {
      if (!startedRef.current) {
        posRef.current.x = targetRef.current.x;
        posRef.current.y = targetRef.current.y;
        startedRef.current = true;
      }
      rafRef.current = requestAnimationFrame(update);
    }
  }

  function onLeave() {
    activeRef.current = false;
    // Keep the dim/overlay in sync immediately so the cone releases on leave.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    writeVars();
  }

  useEffect(() => {
    reducedRef.current = pixelPrefersReducedMotion();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Re-write vars whenever the seed-derived spot or color changes (the cone
  // geometry depends on them).
  useEffect(() => {
    writeVars();
  }, [spot, color]);

  return (
    <div
      ref={elRef}
      className={cn("dk-spotlight relative overflow-hidden", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
      <div ref={dimRef} className={styles.overlay} aria-hidden="true" />
      <div ref={glowRef} className={styles.glow} aria-hidden="true" />
    </div>
  );
}
