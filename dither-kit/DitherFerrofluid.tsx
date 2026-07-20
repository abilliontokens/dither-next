"use client";

import { useEffect, useMemo, useRef } from "react";
import { paintFerrofluid, type FerrofluidParams } from "./ferrofluid";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { FerrofluidParams } from "./ferrofluid";
export { paintFerrofluid } from "./ferrofluid";

export type FlowDirection = "up" | "down" | "left" | "right";

// Sampling drift is the negative of the on-screen direction: to make blobs
// travel down the screen, the field is read from the row above.
const FLOW_VEC: Record<FlowDirection, [number, number]> = {
  up: [0, 1],
  down: [0, -1],
  left: [1, 0],
  right: [-1, 0],
};

export interface DitherFerrofluidProps {
  colors?: string[];
  speed?: number;
  scale?: number;
  turbulence?: number;
  fluidity?: number;
  rimWidth?: number;
  sharpness?: number;
  shimmer?: number;
  glow?: number;
  flowDirection?: FlowDirection;
  opacity?: number;
  dither?: number | boolean;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  mouseRadius?: number;
  mouseDampening?: number;
  mixBlendMode?: string;
  paused?: boolean;
  dpr?: number;
  seed?: number;
  renderMode?: DitherRenderMode;
  precompiled?: PrecompiledDither;
  className?: string;
}

// A ~4px backing cell keeps the fbm affordable; dpr scales it for sharpness.
const CELL = 4;
const MAX_COLS = 240;
const MAX_ROWS = 150;

export function DitherFerrofluid({
  colors = ["#27FF64", "#7CFF67", "#A8FFB6"],
  speed = 0.5,
  scale = 1.6,
  turbulence = 1,
  fluidity = 0.1,
  rimWidth = 0.2,
  sharpness = 2.5,
  shimmer = 1.5,
  glow = 2,
  flowDirection = "down",
  opacity = 1,
  dither = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  mouseRadius = 0.35,
  mouseDampening = 0.15,
  mixBlendMode,
  paused = false,
  dpr,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherFerrofluidProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<FerrofluidParams>(() => {
    const flow = FLOW_VEC[flowDirection];
    return {
      colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
      speed,
      scale,
      turbulence,
      fluidity,
      rimWidth,
      sharpness,
      shimmer,
      glow,
      flowX: flow[0],
      flowY: flow[1],
      opacity: clamp01(opacity),
      dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
      mouseStrength,
      mouseRadius,
    };
  }, [colors, speed, scale, turbulence, fluidity, rimWidth, sharpness, shimmer, glow, flowDirection, opacity, dither, mouseStrength, mouseRadius]);
  const matrix = useMemo(() => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4), [seed]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const target = useRef({ x: 0.5, y: 0.5 });
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useDitherBackground({
    wrapRef, canvasRef,
    cell: CELL, maxCols: MAX_COLS, maxRows: MAX_ROWS,
    dpr: () => dpr, paused: () => paused,
    renderMode: () => renderMode, precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number, dt: number) => {
      // Eased pointer follow — mouseDampening is the time constant in seconds.
      const tau = mouseDampening;
      if (tau <= 0 || dt <= 0) {
        mouse.current.x = target.current.x;
        mouse.current.y = target.current.y;
      } else {
        const k = 1 - Math.exp(-dt / tau);
        mouse.current.x += (target.current.x - mouse.current.x) * k;
        mouse.current.y += (target.current.y - mouse.current.y) * k;
      }
      paintFerrofluid(buffer, params, clock, matrix, mouseInteraction ? mouse.current : null);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointerMove = (e: PointerEvent) => {
      const c = canvasRef.current; if (!c) return;
      const r = c.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
      target.current.x = (e.clientX - r.left) / r.width;
      target.current.y = (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  return (
    <div ref={wrapRef} aria-hidden="true" className={cn("relative block h-full w-full overflow-hidden", className)}>
      {precompiled ? (
        <img src={precompiled} alt="" className="absolute inset-0 h-full w-full object-fill" style={{ imageRendering: "pixelated", mixBlendMode: mixBlendMode as never }} />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated", mixBlendMode: mixBlendMode as never }} />
      )}
    </div>
  );
}
