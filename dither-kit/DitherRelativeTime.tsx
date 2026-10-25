"use client";

import { useEffect, useState, type TimeHTMLAttributes } from "react";

import { cn } from "./lib";
import { useInDom } from "./use-in-dom";

/** "3 minutes ago" / "in 2 days" through Intl.RelativeTimeFormat — the unit
 * ladder picks the largest sane unit, `numeric: "auto"` turns zero into
 * "now". `auto` re-ticks on an interval (a non-zero updateInterval makes
 * itself a second tick); pass `now` for a frozen, testable clock.
 * Port of RelativeTime.vue.
 *
 * Hydration: the locale is an explicit prop (never sniffed). Without `now`
 * the text reads the wall clock, which differs between the server render and
 * hydration; that one text mismatch is suppressed and, once mounted, the
 * element is re-keyed so the client's reading replaces the server's instead
 * of React keeping the stale server text. With `now` the output is pure. */
export interface DitherRelativeTimeProps extends Omit<TimeHTMLAttributes<HTMLElement>, "children"> {
  date: Date | string | number;
  locale?: string;
  auto?: boolean;
  /** Frozen clock (epoch ms). Disables ticking. */
  now?: number;
  /** Re-tick period in ms when `auto`; `0` disables ticking. */
  updateInterval?: number;
  className?: string;
}

function formatRelative(date: Date | string | number, now: number, locale: string): string {
  const target = new Date(date).getTime();
  const diffMs = target - now; // negative = past, positive = future
  const sgn = Math.sign(diffMs);
  const abs = Math.abs(diffMs);
  const sec = abs / 1000;
  const min = sec / 60;
  const hr = min / 60;
  const day = hr / 24;
  const week = day / 7;
  const month = day / 30.44;
  const year = day / 365.25;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (sec < 45) [value, unit] = [Math.round(sgn * sec), "second"];
  else if (min < 45) [value, unit] = [Math.round(sgn * min), "minute"];
  else if (hr < 22) [value, unit] = [Math.round(sgn * hr), "hour"];
  else if (day < 6) [value, unit] = [Math.round(sgn * day), "day"];
  else if (week < 4) [value, unit] = [Math.round(sgn * week), "week"];
  else if (month < 11) [value, unit] = [Math.round(sgn * month), "month"];
  else [value, unit] = [Math.round(sgn * year), "year"];

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}

export function DitherRelativeTime({
  date,
  locale = "en-US",
  auto = true,
  now,
  updateInterval = 30_000,
  className,
  ...rest
}: DitherRelativeTimeProps) {
  const mounted = useInDom();
  // Each tick re-renders, which re-reads the wall clock below.
  const [, setTick] = useState(0);
  const ticking = auto && now === undefined && updateInterval > 0;

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setTick((t) => t + 1), updateInterval);
    return () => clearInterval(timer);
  }, [ticking, updateInterval]);

  const clockDependent = now === undefined;
  const text = formatRelative(date, now ?? Date.now(), locale);
  return (
    <time
      {...rest}
      key={clockDependent && mounted ? "live" : "ssr"}
      suppressHydrationWarning={clockDependent}
      className={cn(className)}
    >
      {text}
    </time>
  );
}

export default DitherRelativeTime;
