"use client";

import { useMemo, useRef } from "react";
import { paintLiquidChrome, type LiquidChromeParams } from "./liquid-chrome";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { LiquidChromeParams } from "./liquid-chrome";
export { paintLiquidChrome } from "./liquid-chrome";

export interface DitherLiquidChromeProps {
  colors?: string[];
  scale?: number;
  speed?: number;
  distortion?: number;
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

const CELL = 4;
const MAX_COLS = 240;
const MAX_ROWS = 150;

export function DitherLiquidChrome({
  colors = ["#1A1A22", "#8890A0", "#E8ECF4"],
  scale = 2,
  speed = 0.4,
  distortion = 1,
  opacity = 1,
  dither = 1,
  paused = false,
  dpr,
  mixBlendMode,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherLiquidChromeProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<LiquidChromeParams>(() => ({
    colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
    scale,
    speed,
    distortion,
    opacity: clamp01(opacity),
    dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
  }), [colors, scale, speed, distortion, opacity, dither]);
  const matrix = useMemo(() => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4), [seed]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useDitherBackground({
    wrapRef, canvasRef,
    cell: CELL, maxCols: MAX_COLS, maxRows: MAX_ROWS,
    dpr: () => dpr, paused: () => paused,
    renderMode: () => renderMode, precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) => paintLiquidChrome(buffer, params, clock, matrix),
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
