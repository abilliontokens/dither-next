import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Ratio → percent. Input is the FRACTION (0.42 → 42%) because that is what
 * Intl's percent style expects; decimals default to zero for the clean read.
 * Port of PercentText.vue. Pure render — no `"use client"`. */
export interface DitherPercentTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  decimals?: number;
  locale?: string;
  className?: string;
}

export function DitherPercentText({ value, decimals = 0, locale = "en-US", className, ...rest }: DitherPercentTextProps) {
  const text = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return (
    <span {...rest} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

export default DitherPercentText;
