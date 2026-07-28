"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./lib";
import { glyphFromSeed, type Glyph } from "./dither-paint";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherGlyphTrail.module.css";

/** A cursor trail of seeded dithered glyphs. Each stamp is a Glyph (dot, plus,
 * x, streak, asterisk) from glyphFromSeed, fading over its lifetime. The glyph
 * shape cycles through the seed space so the trail has variety, not a single
 * dot - but each stamp is deterministic for its index. */
type TrailStamp = {
  x: number;
  y: number;
  glyph: Glyph;
  life: number;
  maxLife: number;
};

/** Build a small palette of glyphs from the seed so the trail draws from a
 * seeded set of shapes. */
function glyphPaletteFromSeed(seed: number, count: number): Glyph[] {
  return Array.from({ length: count }, (_, i) => glyphFromSeed(seed + i * 131));
}

export interface DitherGlyphTrailProps {
  seed?: number;
  color?: string;
  maxStamps?: number;
  lifetime?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherGlyphTrail - a cursor trail of seeded dithered glyph SVG stamps. Each
 * stamp is a Glyph (dot, plus, x, streak, asterisk) from glyphFromSeed, fading
 * over its lifetime. A `requestAnimationFrame` loop runs only while stamps
 * remain. Honors `prefers-reduced-motion` (moves are no-ops; the overlay is
 * hidden via co-located CSS).
 *
 * React port of DitherGlyphTrail.vue.
 */
export function DitherGlyphTrail({
  seed = 42,
  color = "var(--foreground)",
  maxStamps = 20,
  lifetime = 500,
  className,
  children,
}: DitherGlyphTrailProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const stampsRef = useRef<TrailStamp[]>([]);
  const rafRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastFrameRef = useRef(0);
  const paletteRef = useRef<Glyph[]>([]);
  const paletteIdxRef = useRef(0);
  const reducedRef = useRef(false);
  const [, setVersion] = useState(0);
  const force = () => setVersion((v) => v + 1);

  function onMove(e: React.PointerEvent) {
    if (!elRef.current || reducedRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    // Throttle spawning so fast moves don't flood.
    if (now - lastSpawnRef.current < 30) return;
    lastSpawnRef.current = now;
    const pal = paletteRef.current;
    const next = stampsRef.current.concat({
      x,
      y,
      glyph: pal[paletteIdxRef.current % pal.length],
      life: lifetime,
      maxLife: lifetime,
    });
    paletteIdxRef.current++;
    stampsRef.current = next.length > maxStamps ? next.slice(-maxStamps) : next;
    force();
    if (!rafRef.current) {
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(update);
    }
  }

  function update(now: number) {
    rafRef.current = 0;
    const dt = now - lastFrameRef.current;
    lastFrameRef.current = now;
    stampsRef.current = stampsRef.current
      .map((s) => ({ ...s, life: s.life - dt }))
      .filter((s) => s.life > 0);
    force();
    if (stampsRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(update);
    }
  }

  function glyphToSvg(glyph: Glyph, alpha: number): string {
    // Render the glyph as a tiny SVG group of rects, one per pixel.
    const pixels = glyph
      .map(
        (p) =>
          `<rect x="${p.dx * 4}" y="${p.dy * 4}" width="4" height="4" fill="${color}" opacity="${(p.a * alpha).toFixed(2)}"/>`,
      )
      .join("");
    return `<g>${pixels}</g>`;
  }

  // Mount: read reduced-motion + build the seeded glyph palette. A seed change
  // rebuilds the palette (mirrors Vue's watch); re-checking reduced motion on a
  // seed change is harmless and keeps it in one effect.
  useEffect(() => {
    reducedRef.current = pixelPrefersReducedMotion();
    paletteRef.current = glyphPaletteFromSeed(seed, 6);
  }, [seed]);

  // Unmount: cancel any running RAF loop. Kept separate from the seed effect so
  // a seed change mid-trail does NOT kill the fade (matches Vue's watch, which
  // only rebuilds the palette).
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stamps = stampsRef.current;

  return (
    <div ref={elRef} className={cn(className)} onPointerMove={onMove}>
      {children}
      <svg
        className={styles.trail}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {stamps.map((s, i) => (
          <g
            key={i}
            transform={`translate(${s.x - 2}, ${s.y - 2})`}
            dangerouslySetInnerHTML={{
              __html: glyphToSvg(s.glyph, s.life / s.maxLife),
            }}
          />
        ))}
      </svg>
    </div>
  );
}
