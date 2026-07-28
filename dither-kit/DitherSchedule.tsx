import { cssColor } from "./palette";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

export type ScheduleEvent = {
  start: number;
  end: number;
  label: string;
  color?: PixelColor;
};

/** Fractional hour → `HH:MM`. 9.5 → "09:30". Verbatim port of the Vue
 *  module-scope `fmt`. */
function fmt(h: number): string {
  return `${String(Math.floor(h)).padStart(2, "0")}:${String(
    Math.round((h % 1) * 60),
  ).padStart(2, "0")}`;
}

export interface DitherScheduleProps {
  events: ScheduleEvent[];
  /** Day window, fractional hours. */
  from?: number;
  to?: number;
  /** Draw the now line at this hour; omit to hide. */
  now?: number;
  className?: string;
}

/**
 * DitherSchedule — day timeline with an hour rail, events placed
 * proportionally, and an optional red "now" line. Verbatim port of
 * DitherSchedule.vue.
 *
 * Hours are fractional (9.5 is half past nine). Pure presentational
 * component: no hooks, no browser APIs, `cssColor` is SSR-safe — so no
 * `"use client"` directive is required (guide §1: pure render components MAY
 * stay Server Components).
 */
export function DitherSchedule({
  events,
  from = 8,
  to = 18,
  now,
  className,
}: DitherScheduleProps) {
  const span = Math.max(1, to - from);
  const pct = (h: number): string =>
    `${((Math.min(Math.max(h, from), to) - from) / span) * 100}%`;
  const hours = Array.from(
    { length: Math.floor(to) - Math.ceil(from) + 1 },
    (_, i) => Math.ceil(from) + i,
  );

  return (
    <div
      className={cn("flex gap-2 font-mono", className)}
      role="group"
      aria-label="Day schedule"
    >
      <div
        className="relative w-10 shrink-0 text-right"
        aria-hidden="true"
      >
        {hours.map((h) => (
          <span
            key={h}
            className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-muted-foreground/60"
            style={{ top: pct(h) }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
      <div className="relative min-h-48 flex-1 overflow-hidden rounded-md border border-border/60 bg-background/40">
        {hours.map((h) => (
          <span
            key={h}
            aria-hidden="true"
            className="absolute inset-x-0 h-px bg-border/30"
            style={{ top: pct(h) }}
          />
        ))}
        {events.map((e, i) => (
          <div
            key={i}
            className="absolute inset-x-1.5 overflow-hidden rounded-[4px] border border-border/60 bg-card/80 px-2 py-1"
            style={{
              top: pct(e.start),
              height: `calc(${((Math.min(e.end, to) - Math.max(e.start, from)) / span) * 100}% - 2px)`,
            }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[2px]"
              style={{ background: cssColor(e.color ?? "blue") }}
            />
            <p className="truncate pl-1.5 text-[10px] text-foreground">
              {e.label}
            </p>
            <p className="truncate pl-1.5 text-[9px] tabular-nums text-muted-foreground/70">
              {fmt(e.start)}–{fmt(e.end)}
            </p>
          </div>
        ))}
        {now !== undefined && now >= from && now <= to ? (
          <div
            className="absolute inset-x-0 z-10"
            style={{ top: pct(now) }}
            role="presentation"
          >
            <span
              className="absolute -top-[3px] left-0 size-[7px] rounded-full"
              style={{ background: cssColor("red") }}
              aria-hidden="true"
            />
            <span
              className="block h-px w-full"
              style={{ background: cssColor("red") }}
              aria-hidden="true"
            />
            <span className="sr-only">Current time {fmt(now)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
