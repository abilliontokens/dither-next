"use client";

import { useMemo } from "react";

import { cn } from "./lib";

export interface DitherGradualBlurProps {
  position?: "bottom" | "top";
  height?: number;
  strength?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherGradualBlur — a progressive edge blur (iOS-style): a masked
 * backdrop-filter strip so content dissolves toward the chosen edge.
 *
 * React port of GradualBlur.vue. No scoped styles in the Vue source — all
 * styling is inline + Tailwind utilities, preserved verbatim.
 */
export function DitherGradualBlur({
  position = "bottom",
  height = 96,
  strength = 4,
  className,
  children,
}: DitherGradualBlurProps) {
  const mask = useMemo(
    () =>
      position === "top"
        ? "linear-gradient(to bottom, black, transparent)"
        : "linear-gradient(to top, black, transparent)",
    [position],
  );

  return (
    <div className={cn("relative", className)}>
      {children}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0",
          position === "top" ? "top-0" : "bottom-0",
        )}
        style={{
          height: `${height}px`,
          backdropFilter: `blur(${strength}px)`,
          WebkitBackdropFilter: `blur(${strength}px)`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
    </div>
  );
}
