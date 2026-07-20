"use client";

import { useEffect, useMemo, useRef } from "react";
import { paintEvilEye, type EvilEyeParams } from "./evil-eye";
import { cn } from "./lib";
import { BAYER4, clamp01, pixelMatrixFromSeed } from "./pixel";
import { hexToRgb } from "./palette";
import type { RasterBuffer } from "./raster";
import { precompiledSrc, type DitherRenderMode, type PrecompiledDither } from "./precompile";
import { useDitherBackground } from "./use-dither-background";

export type { EvilEyeParams } from "./evil-eye";
export { paintEvilEye } from "./evil-eye";

export interface DitherEvilEyeProps {
  colors?: string[];
  size?: number;
  speed?: number;
  pupilSize?: number;
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

const CELL = 4;
const MAX_COLS = 240;
const MAX_ROWS = 150;

export function DitherEvilEye({
  colors = ["#0A0A0A", "#FF3D2E", "#FFD23D"],
  size = 0.55,
  speed = 0.5,
  pupilSize = 0.4,
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
}: DitherEvilEyeProps) {
  const precompiled = useMemo(() => precompiledSrc(precompiledProp), [precompiledProp]);
  const params = useMemo<EvilEyeParams>(() => ({
    colors: (colors.length ? colors : ["#ffffff"]).slice(0, 8).map(hexToRgb),
    size,
    speed,
    pupilSize,
    glow,
    opacity: clamp01(opacity),
    dither: dither === true ? 1 : dither === false ? 0 : clamp01(dither),
    mouseStrength,
  }), [colors, size, speed, pupilSize, glow, opacity, dither, mouseStrength]);
  const matrix = useMemo(() => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4), [seed]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useDitherBackground({
    wrapRef, canvasRef,
    cell: CELL, maxCols: MAX_COLS, maxRows: MAX_ROWS,
    dpr: () => dpr, paused: () => paused,
    renderMode: () => renderMode, precompiled: () => precompiled,
    restart: () => [seed, renderMode, precompiled, dpr],
    render: (buffer: RasterBuffer, clock: number) =>
      paintEvilEye(buffer, params, clock, matrix, mouseInteraction ? mouse.current : null),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointerMove = (e: PointerEvent) => {
      const c = canvasRef.current; if (!c) return;
      const r = c.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
      mouse.current.x = (e.clientX - r.left) / r.width;
      mouse.current.y = (e.clientY - r.top) / r.height;
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
