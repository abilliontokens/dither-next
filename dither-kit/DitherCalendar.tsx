"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";

import { cn } from "./lib";

/** Month grid calendar: real grid semantics (`role="grid"`, arrows move the
 * day, PageUp/PageDown change month, Home/End jump to week edges), ISO
 * YYYY-MM-DD model so timezone math never enters the picture. Today gets a
 * ring, the selected day gets the fill.
 * Port of Calendar.vue (`update:modelValue` → `onChange`, `select` →
 * `onSelect`; the `modelValue` watch → an effect on `value`). SSR: upstream
 * reads `new Date()` at setup; here "today" is a client-only snapshot (null
 * on the server and during hydration) and a value-less calendar renders a
 * fixed month until it resolves, so server and client markup always match. */
export interface DitherCalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "onSelect"> {
  value?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  className?: string;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

type Cell = { iso: string; day: number; inMonth: boolean };

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// useSyncExternalStore inputs (stable identities): no store updates — upstream
// also reads the clock once — and a null server snapshot, so "today" is only
// known on the client and never enters the server or hydration markup.
const subscribeNever = () => () => {};
const clientToday = () => toISO(new Date());
const serverToday = () => null;

export function DitherCalendar({
  value = "",
  min,
  max,
  disabled = false,
  onChange,
  onSelect,
  className,
  ...rest
}: DitherCalendarProps) {
  const today = useSyncExternalStore<string | null>(subscribeNever, clientToday, serverToday);
  // null = follow today (upstream's `parseISO(modelValue) ?? new Date()`); until
  // today resolves (server render, hydration pass) a fixed month stands in.
  const [cursorState, setCursor] = useState<Date | null>(() => parseISO(value));
  const cursor = cursorState ?? (today ? parseISO(today) : null) ?? new Date(2000, 0, 1);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthLabel = MONTH_LABEL.format(cursor);

  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const rows: Cell[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w++) {
      const row: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        row.push({ iso: toISO(cur), day: cur.getDate(), inMonth: cur.getMonth() === month });
        cur.setDate(cur.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [year, month]);

  // a model that moves outside the visible month re-centers the grid
  useEffect(() => {
    const d = parseISO(value);
    if (!d) return;
    setCursor((c) => (c && c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() ? c : d));
  }, [value]);

  function clampISO(iso: string): string {
    if (min && iso < min) return min;
    if (max && iso > max) return max;
    return iso;
  }

  function isDisabled(iso: string): boolean {
    return Boolean((min && iso < min) || (max && iso > max) || disabled);
  }

  function pick(iso: string): void {
    if (isDisabled(iso)) return;
    onChange?.(iso);
    onSelect?.(iso);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const base = parseISO(value) ?? cursor;
    const d = new Date(base);
    switch (e.key) {
      case "ArrowLeft":
        d.setDate(d.getDate() - 1);
        break;
      case "ArrowRight":
        d.setDate(d.getDate() + 1);
        break;
      case "ArrowUp":
        d.setDate(d.getDate() - 7);
        break;
      case "ArrowDown":
        d.setDate(d.getDate() + 7);
        break;
      case "PageUp":
        d.setMonth(d.getMonth() - 1);
        break;
      case "PageDown":
        d.setMonth(d.getMonth() + 1);
        break;
      case "Home":
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        break;
      case "End":
        d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(clampISO(toISO(base)));
        return;
      default:
        return;
    }
    e.preventDefault();
    const next = clampISO(toISO(d));
    setCursor(parseISO(next) ?? cursor);
    if (!isDisabled(next) && next !== value) onChange?.(next);
  }

  return (
    <div
      {...rest}
      className={cn(
        "w-64 rounded-md border border-border bg-background/60 p-2",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span className="text-[13px] font-medium">{monthLabel}</span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-0.5" onKeyDown={onKeyDown}>
        {WEEKDAYS.map((wd) => (
          <span
            key={wd}
            role="columnheader"
            className="py-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            {wd}
          </span>
        ))}
        {weeks.map((row, wi) => (
          <Fragment key={wi}>
            {row.map((cell) => (
              <button
                key={cell.iso}
                id={`dk-cal-${cell.iso}`}
                type="button"
                role="gridcell"
                tabIndex={cell.iso === (value || today) ? 0 : -1}
                aria-selected={cell.iso === value}
                aria-current={cell.iso === today ? "date" : undefined}
                disabled={isDisabled(cell.iso)}
                className={cn(
                  "aspect-square rounded text-[12px] tabular-nums transition-colors motion-reduce:transition-none",
                  cell.iso === value
                    ? "bg-accent/20 text-foreground ring-1 ring-accent/60"
                    : cell.iso === today
                      ? "text-foreground ring-1 ring-foreground/30"
                      : cell.inMonth
                        ? "text-foreground/90 hover:bg-accent/10"
                        : "text-muted-foreground/50 hover:bg-accent/10",
                )}
                onClick={() => pick(cell.iso)}
              >
                {cell.day}
              </button>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default DitherCalendar;
