import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Money through Intl — currency decides symbol placement, locale decides
 * the grammar (both are the runtime's job, not ours). Locale and currency are
 * explicit props with fixed defaults, never sniffed from the environment, so
 * the server render and hydration produce the same string.
 * Port of CurrencyText.vue. Pure render — no `"use client"`. */
export interface DitherCurrencyTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  currency?: string;
  locale?: string;
  decimals?: number;
  className?: string;
}

export function DitherCurrencyText({
  value,
  currency = "USD",
  locale = "en-US",
  decimals = 2,
  className,
  ...rest
}: DitherCurrencyTextProps) {
  const text = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return (
    <span {...rest} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

export default DitherCurrencyText;
