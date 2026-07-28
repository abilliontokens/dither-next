"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { cssColor, colorToHex } from "./palette";
import {
  BAYER4,
  fillOf,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";

export type TimeValue = string | number;

export interface DitherTimePickerProps {
  /** Controlled value: "HH:MM" string or minutes-since-midnight (0–1439). */
  value?: TimeValue;
  /** 12-hour mode renders an AM/PM segmented toggle. */
  hour12?: boolean;
  /** Minute granularity + arrow step (1 = every minute). */
  minuteStep?: number;
  /** Dither fill colour for the selected hour / minute / period. */
  color?: PixelColor;
  /** Visible rows in each column (odd reads best). */
  rows?: number;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: TimeValue) => void;
}

// --- pure value helpers (module scope, SSR-safe) ---------------------------

function parseValue(value: TimeValue | undefined): number {
  if (typeof value === "number") return ((value % 1440) + 1440) % 1440;
  if (typeof value === "string") {
    const m = /^\s*(\d{1,2}):(\d{1,2})/.exec(value);
    if (m) {
      const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
      const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
      return h * 60 + min;
    }
  }
  return 0;
}

function formatHHMM(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Bayer-ordered dither fill as an inline SVG data-URI tile. A selected cell
 * reads as the kit's signature scattered pixels (intensity = lit fraction),
 * never a smooth alpha gradient. Pure string math — SSR-safe in render.
 */
function bayerFill(color: PixelColor, intensity: number): React.CSSProperties {
  const hex = colorToHex(color);
  const cell = 2;
  const rects: string[] = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER4[y][x] <= intensity) {
        rects.push(
          `<rect x='${x * cell}' y='${y * cell}' width='${cell}' height='${cell}' fill='${hex}'/>`,
        );
      }
    }
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${4 * cell}' height='${4 * cell}'>` +
    `${rects.join("")}</svg>`;
  const [r, g, b] = fillOf(color);
  return {
    backgroundColor: `rgba(${r},${g},${b},0.08)`,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${4 * cell}px ${4 * cell}px`,
    color: cssColor(color),
  };
}

/** Keyboard step over a listbox index. Returns the next index, or null when
 *  the key is not a navigation/commit key. Enter/Space re-commits the active. */
function stepIndex(key: string, idx: number, n: number, big = 5): number | null {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return (idx - 1 + n) % n;
    case "ArrowDown":
    case "ArrowRight":
      return (idx + 1) % n;
    case "PageUp":
      return (idx - big + n * 1000) % n;
    case "PageDown":
      return (idx + big) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    case "Enter":
    case " ":
    case "Spacebar":
      return idx;
    default:
      return null;
  }
}

/**
 * DitherTimePicker — compact hour / minute selector.
 *
 * Two self-contained columns (no DitherWheelPicker dependency): each is a WAI
 * `listbox` whose selected option carries a Bayer-dithered cell fill. Selection
 * follows focus (standard listbox semantics): Arrow / Home / End / PageUp /
 * PageDown move and select in one motion; Tab walks hour → minute → AM/PM.
 *
 * The value is fully controlled — every navigation calls `onChange`, and the
 * active option is derived from `value`, so there is no drift between the
 * rendered highlight and the model. `value` accepts "HH:MM" or minutes-since-
 * midnight and `onChange` echoes whichever form the consumer passed in.
 * `prefers-reduced-motion` (resolved in a mount effect) snaps scroll-into-view
 * to instant.
 *
 * Dither language: the selected hour, minute, and period read as ordered-dither
 * tiles via {@link bayerFill} — the same 4×4 BAYER4 matrix the charts dither
 * with — rather than solid colour blocks.
 */
export function DitherTimePicker({
  value,
  hour12 = false,
  minuteStep = 1,
  color = "blue",
  rows = 7,
  ariaLabel = "Time picker",
  className,
  onChange,
}: DitherTimePickerProps) {
  const reactId = useId();
  const hourBoxRef = useRef<HTMLDivElement | null>(null);
  const minuteBoxRef = useRef<HTMLDivElement | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  const isMinutesValue = typeof value === "number";
  const totalMins = parseValue(value);
  const hours24 = Math.floor(totalMins / 60) % 24;
  const mins = totalMins % 60;
  const period: "AM" | "PM" = hours24 < 12 ? "AM" : "PM";

  const hourList = useMemo(
    () => (hour12 ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 24 }, (_, i) => i)),
    [hour12],
  );
  const minuteList = useMemo(() => {
    const step = Math.max(1, Math.floor(minuteStep));
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    return arr;
  }, [minuteStep]);

  const dispHour = hour12 ? (hours24 % 12 === 0 ? 12 : hours24 % 12) : hours24;
  const hourIdx = Math.max(0, hourList.indexOf(dispHour));
  const minuteIdx = useMemo(() => {
    let best = 0;
    let bd = Infinity;
    minuteList.forEach((m, i) => {
      const d = Math.abs(m - mins);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }, [minuteList, mins]);

  const selectedStyle = useMemo(() => bayerFill(color, 0.62), [color]);

  function emit(total: number): void {
    onChange?.(isMinutesValue ? total : formatHHMM(total));
  }
  function commitHour(dispH: number): void {
    let h24: number;
    if (hour12) {
      const h12 = dispH % 12; // 12 → 0 for the 24h math
      h24 = period === "AM" ? h12 : h12 + 12;
    } else {
      h24 = dispH;
    }
    emit(h24 * 60 + mins);
  }
  function commitMinute(m: number): void {
    emit(hours24 * 60 + m);
  }
  function commitPeriod(p: "AM" | "PM"): void {
    const h12 = hours24 % 12;
    emit((p === "AM" ? h12 : h12 + 12) * 60 + mins);
  }

  // Keep the active option scrolled into view (initial mount + external value
  // changes). `scrollIntoView` is DOM work — kept in an effect, never render.
  useEffect(() => {
    hourBoxRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [hourIdx, still]);
  useEffect(() => {
    minuteBoxRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [minuteIdx, still]);

  function onHourKey(e: React.KeyboardEvent<HTMLDivElement>): void {
    const next = stepIndex(e.key, hourIdx, hourList.length);
    if (next === null) return;
    e.preventDefault();
    commitHour(hourList[next]);
  }
  function onMinuteKey(e: React.KeyboardEvent<HTMLDivElement>): void {
    const next = stepIndex(e.key, minuteIdx, minuteList.length);
    if (next === null) return;
    e.preventDefault();
    commitMinute(minuteList[next]);
  }

  const boxHeight = rows * 30;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3 font-mono",
        className,
      )}
    >
      <div
        className="flex items-baseline gap-1 px-1 text-foreground"
        aria-hidden="true"
      >
        <span className="text-lg font-medium tabular-nums">{pad2(hour12 ? dispHour : hours24)}</span>
        <span className="text-muted-foreground">:</span>
        <span className="text-lg font-medium tabular-nums">{pad2(mins)}</span>
        {hour12 ? (
          <span className="ml-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {period}
          </span>
        ) : null}
      </div>

      <div className="flex gap-2">
        <div
          ref={hourBoxRef}
          role="listbox"
          aria-label="Hour"
          aria-activedescendant={`${reactId}-h-${hourIdx}`}
          tabIndex={0}
          className={cn(
            "w-16 snap-y overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-background/60 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          )}
          style={{ height: boxHeight }}
          onKeyDown={onHourKey}
        >
          {hourList.map((h, i) => {
            const active = i === hourIdx;
            return (
              <div
                key={h}
                id={`${reactId}-h-${i}`}
                role="option"
                aria-selected={active}
                data-active={active || undefined}
                tabIndex={-1}
                onClick={() => commitHour(h)}
                style={active ? selectedStyle : undefined}
                className={cn(
                  "mx-1 flex h-[26px] cursor-pointer items-center justify-center rounded text-[13px] tabular-nums",
                  active ? "font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {pad2(h)}
              </div>
            );
          })}
        </div>

        <div
          ref={minuteBoxRef}
          role="listbox"
          aria-label="Minute"
          aria-activedescendant={`${reactId}-m-${minuteIdx}`}
          tabIndex={0}
          className={cn(
            "w-16 snap-y overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-background/60 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          )}
          style={{ height: boxHeight }}
          onKeyDown={onMinuteKey}
        >
          {minuteList.map((m, i) => {
            const active = i === minuteIdx;
            return (
              <div
                key={m}
                id={`${reactId}-m-${i}`}
                role="option"
                aria-selected={active}
                data-active={active || undefined}
                tabIndex={-1}
                onClick={() => commitMinute(m)}
                style={active ? selectedStyle : undefined}
                className={cn(
                  "mx-1 flex h-[26px] cursor-pointer items-center justify-center rounded text-[13px] tabular-nums",
                  active ? "font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {pad2(m)}
              </div>
            );
          })}
        </div>

        {hour12 ? (
          <div role="group" aria-label="AM or PM" className="flex flex-col gap-1">
            {(["AM", "PM"] as const).map((p) => {
              const active = p === period;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => commitPeriod(p)}
                  style={active ? selectedStyle : undefined}
                  className={cn(
                    CONTROL_BUTTON,
                    "flex h-[36px] w-12 items-center justify-center rounded-md border text-xs uppercase tracking-[0.15em]",
                    active
                      ? "border-transparent font-medium"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
