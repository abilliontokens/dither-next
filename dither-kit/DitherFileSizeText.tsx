import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Bytes → human units. 1024-based (the convention disk tools actually use),
 * sub-KB sizes stay whole numbers, sign preserved.
 * Port of FileSizeText.vue. Pure render — no `"use client"`. */
export interface DitherFileSizeTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  bytes?: number;
  decimals?: number;
  locale?: string;
  className?: string;
}

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

function formatFileSize(n: number, decimals: number, locale: string): string {
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} ${UNITS[0]}`;
  let unit = 1;
  let scaled = abs / 1024;
  while (scaled >= 1024 && unit < UNITS.length - 1) {
    scaled /= 1024;
    unit++;
  }
  const fixed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(scaled);
  return `${n < 0 ? "-" : ""}${fixed} ${UNITS[unit]}`;
}

export function DitherFileSizeText({
  bytes = 0,
  decimals = 1,
  locale = "en-US",
  className,
  ...rest
}: DitherFileSizeTextProps) {
  return (
    <span {...rest} className={cn("tabular-nums", className)}>
      {formatFileSize(bytes, decimals, locale)}
    </span>
  );
}

export default DitherFileSizeText;
