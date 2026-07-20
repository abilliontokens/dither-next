"use client";

import { useMemo, useRef } from "react";
import { paintDarkVeil, type DarkVeilParams } from "./dark-veil";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { DarkVeilParams } from "./dark-veil";
export { paintDarkVeil } from "./dark-veil";

export interface DitherDarkVeilProps {
  colors?: string[];
  scale?: number;
  speed?: number;
  intensity?: number;
  vignette?: number;
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

export function DitherDarkVeil({
  colors = ["#0A0A12", "#3A2A6A", "#5227FF"],
  scale = 3,
  speed = 0.4,
  intensity = 2.5,
  vignette = 0.7,
  opacity = 1,
  dither = 1,
  paused = false,
  dpr,
  mixBlendMode,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherDarkVeilProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<DarkVeilParams>(() => ({
    colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
    scale,
    speed,
    intensity,
    vignette,
    opacity: clamp01(opacity),
    dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
  }), [colors, scale, speed, intensity, vignette, opacity, dither]);
  const matrix = useMemo(() => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4), [seed]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useDitherBackground({
    wrapRef, canvasRef,
    cell: CELL, maxCols: MAX_COLS, maxRows: MAX_ROWS,
    dpr: () => dpr, paused: () => paused,
    renderMode: () => renderMode, precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) => paintDarkVeil(buffer, params, clock, matrix),
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
