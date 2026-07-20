"use client";

import { useMemo, useRef } from "react";
import { paintGridMotion, type GridMotionParams } from "./grid-motion";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { GridMotionParams } from "./grid-motion";
export { paintGridMotion } from "./grid-motion";

export interface DitherGridMotionProps {
  colors?: string[];
  count?: number;
  angle?: number;
  speed?: number;
  lineWidth?: number;
  glow?: number;
  opacity?: number;
  dither?: number | boolean;
  paused?: boolean;
  dpr?: number;
  mixBlendMode?: string;
  seed?: number;
  renderMode?: DitherRenderMode;
  precompiled?: PrecompiledDither;
  className?: string;
}

const CELL = 3;
const MAX_COLS = 260;
const MAX_ROWS = 170;

export function DitherGridMotion({
  colors = ["#3DA5FF", "#7CE0FF"],
  count = 14,
  angle = 0.5,
  speed = 0.5,
  lineWidth = 0.06,
  glow = 1.5,
  opacity = 1,
  dither = 1,
  paused = false,
  dpr,
  mixBlendMode,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherGridMotionProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<GridMotionParams>(
    () => ({
      colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
      count,
      angle,
      speed,
      lineWidth,
      glow,
      opacity: clamp01(opacity),
      dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
    }),
    [colors, count, angle, speed, lineWidth, glow, opacity, dither],
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
    renderMode: () => renderMode,
    precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) =>
      paintGridMotion(buffer, params, clock, matrix),
  });

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={cn("relative block h-full w-full overflow-hidden", className)}
    >
      {precompiled ? (
        <img
          src={precompiled}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
          style={{ imageRendering: "pixelated", mixBlendMode: mixBlendMode as never }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated", mixBlendMode: mixBlendMode as never }}
        />
      )}
    </div>
  );
}
