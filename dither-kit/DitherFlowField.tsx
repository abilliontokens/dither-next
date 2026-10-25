"use client";

import { useMemo, useRef } from "react";
import { paintFlowField, type FlowFieldParams } from "./flow-field";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { FlowFieldParams } from "./flow-field";
export { paintFlowField, fadeRasterAlpha } from "./flow-field";

export interface DitherFlowFieldProps {
  colors?: string[];
  count?: number;
  speed?: number;
  scale?: number;
  fade?: number;
  glow?: number;
  opacity?: number;
  dither?: number | boolean;
  /** edge fade mask on the wrapper: soft radial pool, horizontal sweep, or none. */
  mask?: "radial" | "linear" | "none";
  paused?: boolean;
  /** the brief's lock: 60 keeps every vsync; 0 = the smooth ~30fps throttle. */
  frameRate?: number;
  dpr?: number;
  mixBlendMode?: string;
  seed?: number;
  renderMode?: DitherRenderMode;
  precompiled?: PrecompiledDither;
  className?: string;
}

const CELL = 3;
const MAX_COLS = 320;
const MAX_ROWS = 200;
const DEFAULT_COLORS = ["#f4f8ff", "#c9dbff", "#7ba3ee"];

const MASKS: Record<string, string | undefined> = {
  radial: "radial-gradient(120% 120% at 50% 40%, black 45%, transparent 100%)",
  linear: "linear-gradient(to bottom, black 60%, transparent 100%)",
};

/**
 * DitherFlowField — thousands of dots advected through a seeded simplex wind,
 * the fading buffer drawing their trails. Port of FlowField.vue on the shared
 * `useDitherBackground` runtime (stop-motion `frameRate` defaults to 60).
 */
export function DitherFlowField({
  colors = DEFAULT_COLORS,
  count = 2400,
  speed = 0.7,
  scale = 1.4,
  fade = 0.96,
  glow = 1,
  opacity = 1,
  dither = 1,
  mask = "radial",
  paused = false,
  frameRate = 60,
  dpr,
  mixBlendMode,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherFlowFieldProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<FlowFieldParams>(
    () => ({
      colors: (colors.length ? colors : ["#f4f8ff"]).slice(0, 8).map(hexToRgb),
      count,
      speed,
      scale,
      fade: clamp01(fade),
      glow,
      opacity: clamp01(opacity),
      dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
      seed: seed ?? 1,
    }),
    [colors, count, speed, scale, fade, glow, opacity, dither, seed],
  );
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useDitherBackground({
    wrapRef,
    canvasRef,
    cell: CELL,
    maxCols: MAX_COLS,
    maxRows: MAX_ROWS,
    dpr: () => dpr,
    paused: () => paused,
    frameRate: () => frameRate,
    renderMode: () => renderMode,
    precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr, count],
    render: (buffer: RasterBuffer, clock: number, dt: number, elapsed: number) =>
      paintFlowField(buffer, params, clock, dt, matrix, elapsed),
  });

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={cn("relative block h-full w-full overflow-hidden", className)}
      style={{
        maskImage: MASKS[mask],
        WebkitMaskImage: MASKS[mask],
        mixBlendMode: mixBlendMode as never,
      }}
    >
      {precompiled ? (
        <img
          src={precompiled}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      )}
    </div>
  );
}

export default DitherFlowField;
