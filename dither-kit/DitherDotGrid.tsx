"use client";

import { useEffect, useMemo, useRef } from "react";
import { paintDotGrid, type DotGridParams } from "./dot-grid";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { DotGridParams } from "./dot-grid";
export { paintDotGrid } from "./dot-grid";

export interface DitherDotGridProps {
  colors?: string[];
  gap?: number;
  dotSize?: number;
  speed?: number;
  glow?: number;
  opacity?: number;
  dither?: number | boolean;
  mouseInteraction?: boolean;
  mouseStrength?: number;
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

export function DitherDotGrid({
  colors = ["#5227FF", "#7CFF67"],
  gap = 26,
  dotSize = 0.5,
  speed = 0.5,
  glow = 1.5,
  opacity = 1,
  dither = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  paused = false,
  dpr,
  mixBlendMode,
  seed,
  renderMode = "live",
  precompiled: precompiledProp,
  className,
}: DitherDotGridProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<DotGridParams>(
    () => ({
      colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
      gap,
      dotSize,
      speed,
      glow,
      opacity: clamp01(opacity),
      dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
      mouseStrength,
    }),
    [colors, gap, dotSize, speed, glow, opacity, dither, mouseStrength],
  );
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });

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
      paintDotGrid(buffer, params, clock, matrix, mouseInteraction ? mouse.current : null),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointerMove = (e: PointerEvent) => {
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      mouse.current.x = (e.clientX - r.left) / r.width;
      mouse.current.y = (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

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
