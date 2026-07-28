"use client";

import { useEffect, useMemo, useState } from "react";

import { mulberry32 } from "./dither-paint";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn } from "./lib";

/** Seeded dash pattern for the progress path's leading edge. The dashes
 * vary per seed so each path draws with a unique dither rhythm. */
export function dashFromSeed(seed: number): string {
  const rand = mulberry32(Math.round(seed) ^ 0x165667b1);
  const segments: string[] = [];
  for (let i = 0; i < 6; i++) {
    segments.push(`${4 + Math.floor(rand() * 8)},${2 + Math.floor(rand() * 4)}`);
  }
  return segments.join(" ");
}

export interface DitherScanProgressProps {
  /** Scroll progress 0..1, or undefined to track the page scroll. */
  progress?: number;
  seed?: number;
  color?: string;
  trackColor?: string;
  width?: number;
  height?: number;
  className?: string;
}

/** DitherScanProgress - an SVG progress path drawn along an S-curve with a
 * seeded dash pattern. Tracks window scroll when `progress` is undefined,
 * otherwise renders the given value directly. */
export function DitherScanProgress({
  progress,
  seed = 42,
  color = "var(--foreground)",
  trackColor = "var(--border)",
  width = 120,
  height = 40,
  className,
}: DitherScanProgressProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  const dashPattern = useMemo(() => dashFromSeed(seed), [seed]);
  const current = progress ?? scrollProgress;

  // Build an S-curve path for the progress to draw along.
  const pathD = useMemo(() => {
    const w = width;
    const h = height;
    const mid = h / 2;
    // A gentle S-curve from left to right.
    return `M 4 ${mid} C ${w * 0.3} ${mid - h * 0.4}, ${w * 0.4} ${mid + h * 0.4}, ${w / 2} ${mid} S ${w * 0.8} ${mid - h * 0.4}, ${w - 4} ${mid}`;
  }, [width, height]);

  // Approximate path length from width (the S-curve is ~1.1x the width).
  const totalLength = useMemo(() => width * 1.15, [width]);

  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());

    if (progress !== undefined) return;

    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setScrollProgress(
        max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [progress]);

  const dashOffset = totalLength * (1 - current);
  const dotCx = 4 + current * (width - 8);
  const dotOpacity = current > 0.01 && current < 0.99 ? 1 : 0;
  const offsetTransition = reduced ? "none" : "stroke-dashoffset 0.1s linear";
  const cxTransition = reduced ? "none" : "cx 0.1s linear";

  return (
    <svg
      className={cn("dk-scan-progress", className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Scroll progress"
      style={{ display: "block" }}
    >
      {/* Track */}
      <path
        d={pathD}
        fill="none"
        stroke={trackColor}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.3}
      />
      {/* Progress fill with seeded dash pattern */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={dashPattern}
        strokeDashoffset={dashOffset}
        pathLength={totalLength}
        style={{ transition: offsetTransition }}
      />
      {/* Leading dot at the current progress position */}
      <circle
        cx={dotCx}
        cy={height / 2}
        r={3}
        fill={color}
        style={{ transition: cxTransition, opacity: dotOpacity }}
      />
    </svg>
  );
}
