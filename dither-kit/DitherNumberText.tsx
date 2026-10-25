import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Locale-aware number rendering — grouping, decimals, locale through Intl,
 * defaults to the house register. The locale is an explicit prop (default
 * `"en-US"`), never sniffed, so server and client format identically.
 * Port of NumberText.vue. Pure render — no `"use client"`. */
export interface DitherNumberTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  decimals?: number;
  locale?: string;
  grouping?: boolean;
  className?: string;
}

export function DitherNumberText({
  value,
  decimals,
  locale = "en-US",
  grouping = true,
  className,
  ...rest
}: DitherNumberTextProps) {
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(value);
  return (
    <span {...rest} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

export default DitherNumberText;
