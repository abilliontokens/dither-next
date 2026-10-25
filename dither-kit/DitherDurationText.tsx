import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Milliseconds → a smart human duration: precision drops as magnitude grows
 * (500ms → 45s → 2m 5s → 22h 20m → 1d 1h), no zero-padding clutter.
 * Port of DurationText.vue. Pure render — no `"use client"`. */
export interface DitherDurationTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  ms?: number;
  className?: string;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (ms < 1000) return `${ms}ms`;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function DitherDurationText({ ms = 0, className, ...rest }: DitherDurationTextProps) {
  return (
    <span {...rest} className={cn(className)}>
      {formatDuration(ms)}
    </span>
  );
}

export default DitherDurationText;
