"use client";

import { useMemo, useRef } from "react";
import { paintRays, type RaysParams } from "./rays";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { RaysParams } from "./rays";
export { paintRays } from "./rays";

export interface DitherSideRaysProps {
  colors?: string[];
  side?: "left" | "right";
  rayCount?: number;
  speed?: number;
  spread?: number;
  falloff?: number;
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

const CELL = 4;
const MAX_COLS = 260;
const MAX_ROWS = 160;

export function DitherSideRays({
  colors = ["#3DA5FF", "#7CE0FF"],
  side = "left",
  rayCount = 12,
  speed = 0.4,
  spread = 1,
  falloff = 0.6,
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
}: DitherSideRaysProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<RaysParams>(
    () => ({
      colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
      sourceX: side === "right" ? 1.05 : -0.05,
      sourceY: 0.5,
      rayCount,
      speed,
      spread,
      falloff,
      glow,
      opacity: clamp01(opacity),
      dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
    }),
    [colors, side, rayCount, speed, spread, falloff, glow, opacity, dither],
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
    restart: () => [seed, side, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) =>
      paintRays(buffer, params, clock, matrix),
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
