"use client";

import { useMemo, useRef } from "react";
import { paintShapeGrid, type ShapeGridParams } from "./shape-grid";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { ShapeGridParams } from "./shape-grid";
export { paintShapeGrid } from "./shape-grid";

export interface DitherShapeGridProps {
  colors?: string[];
  gap?: number;
  speed?: number;
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

export function DitherShapeGrid({
  colors = ["#5227FF", "#7CFF67"],
  gap = 18,
  speed = 0.5,
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
}: DitherShapeGridProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<ShapeGridParams>(() => ({
    colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
    gap,
    speed,
    glow,
    opacity: clamp01(opacity),
    dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
  }), [colors, gap, speed, glow, opacity, dither]);
  const matrix = useMemo(() => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4), [seed]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useDitherBackground({
    wrapRef, canvasRef,
    cell: CELL, maxCols: MAX_COLS, maxRows: MAX_ROWS,
    dpr: () => dpr, paused: () => paused,
    renderMode: () => renderMode, precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) => paintShapeGrid(buffer, params, clock, matrix),
  });

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
