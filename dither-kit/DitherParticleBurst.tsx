"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { Rgb } from "./palette";
import {
  clearRasterBuffer,
  createRasterBuffer,
  putRasterBuffer,
  setOrBlendRasterPixel,
  type RasterBuffer,
} from "./raster";
import { glyphFromSeed, type Glyph, mulberry32 } from "./dither-paint";
import { fillOf, type PixelColor, pixelMatrixFromSeed } from "./pixel";
import { useCanvasVisibility } from "./use-visibility";
import { cn } from "./lib";

const MAX_PARTICLES = 80;

/** A single particle in the burst: position, velocity, life, and its seeded
 * glyph stamp. The glyph comes from glyphFromSeed so each particle is a
 * dithered shape (dot, plus, x, streak, asterisk), not a plain square. */
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  glyph: Glyph;
};

/** Seed the burst's particle set: count, speed spread, glyph shapes, and
 * initial angle distribution. One seed yields a reproducible explosion. */
function burstFromSeed(seed: number, cx: number, cy: number): Particle[] {
  const rand = mulberry32(Math.round(seed) ^ 0x6c62272e);
  const count = 20 + Math.floor(rand() * 30);
  const speedBase = 0.3 + rand() * 0.5;
  const particles: Particle[] = [];
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.3;
    const speed = speedBase * (0.5 + rand());
    const life = 600 + rand() * 600;
    const glyphSeed = Math.round(seed + i * 137);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: life,
      maxLife: life,
      glyph: glyphFromSeed(glyphSeed),
    });
  }
  return particles;
}

/** Stamp a particle's glyph into the buffer at its current position, dimmed
 * by its remaining life. Each glyph pixel is dithered against the matrix. */
function stampGlyph(
  buf: RasterBuffer,
  p: Particle,
  fill: Rgb,
  matrix: number[][]
): void {
  const alpha = Math.max(0, p.life / p.maxLife);
  if (alpha <= 0) return;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  for (const px of p.glyph) {
    const x = cx + px.dx;
    const y = cy + px.dy;
    if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) continue;
    const a = alpha * px.a;
    if (a <= matrix[y & 3][x & 3]) continue;
    setOrBlendRasterPixel(buf, x, y, fill, a);
  }
}

/** Advance one particle: move, apply gravity, decay life. Returns false when
 * the particle is dead. */
function stepParticle(p: Particle, dt: number, gravity: number): boolean {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vy += gravity * dt;
  p.vx *= 0.98; // air drag
  p.life -= dt;
  return p.life > 0;
}

export type DitherParticleBurstHandle = {
  burst: (x: number, y: number) => void;
};

export interface DitherParticleBurstProps {
  color?: PixelColor;
  seed?: number;
  gravity?: number;
  className?: string;
}

/**
 * DitherParticleBurst - a click-triggered particle burst on a low-res canvas.
 * Each click spawns a seeded explosion of glyph particles (dot, plus, x,
 * streak, asterisk) that fly outward, fall under gravity, and fade. The RAF
 * loop runs only while particles are alive and stops once they all expire.
 * Visibility-gated so an off-screen canvas costs nothing.
 *
 * React port of DitherParticleBurst.vue. Exposes `burst(x, y)` on the ref via
 * useImperativeHandle so a parent can trigger a burst programmatically.
 */
export const DitherParticleBurst = forwardRef<
  DitherParticleBurstHandle,
  DitherParticleBurstProps
>(function DitherParticleBurst(
  { color = "blue", seed = 7, gravity = 0.0002, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const matrix = useMemo(() => pixelMatrixFromSeed(seed), [seed]);

  // Mutable runtime state held in refs - the RAF loop owns timing and never
  // needs to re-render the host component.
  const particlesRef = useRef<Particle[]>([]);
  const lastRef = useRef(0);
  const rafRef = useRef(0);
  const bufferRef = useRef<RasterBuffer | undefined>(undefined);
  const imageDataRef = useRef<ImageData | undefined>(undefined);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const burstSeedRef = useRef(seed);
  const teardownRef = useRef<(() => void) | undefined>(undefined);
  const wakeRef = useRef<(() => void) | undefined>(undefined);
  const restartTokenRef = useRef(0);

  // Mirror latest props into refs so the long-lived RAF closure reads fresh
  // values without being rebuilt every render.
  const colorRef = useRef(color);
  const gravityRef = useRef(gravity);
  const matrixRef = useRef(matrix);
  colorRef.current = color;
  gravityRef.current = gravity;
  matrixRef.current = matrix;

  const isVisible = useCanvasVisibility(canvasRef, () => wakeRef.current?.());

  function frame(now: number) {
    rafRef.current = 0;
    const buffer = bufferRef.current;
    if (!isVisible() || !buffer) return;
    const dt = Math.min(50, now - lastRef.current);
    lastRef.current = now;
    clearRasterBuffer(buffer);
    particlesRef.current = particlesRef.current.filter((p) =>
      stepParticle(p, dt, gravityRef.current)
    );
    const fill = fillOf(colorRef.current);
    for (const p of particlesRef.current) {
      stampGlyph(buffer, p, fill, matrixRef.current);
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        imageDataRef.current = putRasterBuffer(ctx, buffer, imageDataRef.current);
      }
    }
    if (particlesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(frame);
    } else {
      // Clear the last frame once all particles fade.
      clearRasterBuffer(buffer);
      const canvas2 = canvasRef.current;
      if (canvas2) {
        const ctx2 = canvas2.getContext("2d", { willReadFrequently: true });
        if (ctx2) {
          putRasterBuffer(ctx2, buffer, imageDataRef.current);
        }
      }
    }
  }

  /** Trigger a burst at canvas-local coordinates. Called from pointerdown. */
  function burst(localX: number, localY: number) {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const cx = (localX / colsRef.current) * colsRef.current;
    const cy = (localY / rowsRef.current) * rowsRef.current;
    burstSeedRef.current = Math.floor(Math.random() * 1_000_000);
    particlesRef.current = burstFromSeed(burstSeedRef.current, cx, cy);
    if (!rafRef.current) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
  }

  useImperativeHandle(ref, () => ({ burst }), []);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    burst(e.clientX - rect.left, e.clientY - rect.top);
  }

  function init(): (() => void) | undefined {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return undefined;
    const rect = canvas.getBoundingClientRect();
    colsRef.current = Math.max(8, Math.round(rect.width));
    rowsRef.current = Math.max(8, Math.round(rect.height));
    canvas.width = colsRef.current;
    canvas.height = rowsRef.current;
    bufferRef.current = createRasterBuffer(colsRef.current, rowsRef.current);
    clearRasterBuffer(bufferRef.current);
    imageDataRef.current = putRasterBuffer(ctx, bufferRef.current);

    wakeRef.current = () => {
      if (!rafRef.current && particlesRef.current.length > 0) {
        lastRef.current = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }

  function restartRuntime() {
    const token = ++restartTokenRef.current;
    teardownRef.current?.();
    teardownRef.current = undefined;
    particlesRef.current = [];
    requestAnimationFrame(() => {
      if (token !== restartTokenRef.current) return;
      teardownRef.current = init();
    });
  }

  // Mount + prop-change restart (Vue onMounted + watch(color/seed/gravity)),
  // with onBeforeUnmount cleanup collapsed into the returned teardown.
  useEffect(() => {
    restartRuntime();
    return () => {
      restartTokenRef.current += 1;
      teardownRef.current?.();
      teardownRef.current = undefined;
    };
  }, [color, seed, gravity]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(className)}
      style={{
        imageRendering: "pixelated",
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "crosshair",
        touchAction: "none",
      }}
      aria-label="Click to trigger a particle burst"
      role="img"
      onPointerDown={onPointerDown}
    />
  );
});
