"use client";

import type { HTMLAttributes } from "react";

import { cn } from "./lib";
import { useInDom } from "./use-in-dom";

/** Date → localized text. Default is the medium date + short time register;
 * any Intl.DateTimeFormatOptions shape overrides it (pass `timeZone` inside
 * options for deterministic cross-machine rendering). An unparseable date
 * renders an em dash — visible, not silent. Port of DateTimeText.vue.
 *
 * Hydration: the locale is an explicit prop (never sniffed). Without an
 * explicit `timeZone` the text depends on the machine's zone, so the server
 * (its zone) and the client (the viewer's zone) can legitimately disagree:
 * the hydration pass suppresses that one text mismatch, and once mounted the
 * element is re-keyed so the viewer's local rendering actually replaces the
 * server text instead of React keeping it. */
export interface DitherDateTimeTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  date?: Date | string | number;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export function DitherDateTimeText({
  date = "",
  locale = "en-US",
  options,
  className,
  ...rest
}: DitherDateTimeTextProps) {
  const mounted = useInDom();
  const d = new Date(date);
  const text = Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(locale, options ?? DEFAULT_OPTIONS);
  const zoneDependent = !options?.timeZone;
  return (
    <span
      {...rest}
      key={zoneDependent && mounted ? "local" : "ssr"}
      suppressHydrationWarning={zoneDependent}
      className={cn("tabular-nums", className)}
    >
      {text}
    </span>
  );
}

export default DitherDateTimeText;
