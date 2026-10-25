"use client";

import { useState, useSyncExternalStore, type HTMLAttributes, type KeyboardEvent } from "react";

import { cn } from "./lib";

/** Year + twelve-month grid: model is `YYYY-MM`, arrows roam the grid,
 * PageUp/PageDown shift the year, the current month gets a ring.
 * Port of MonthPicker.vue (`update:modelValue` → `onChange`). SSR: upstream
 * reads `new Date()` at setup; here the current month is a client-only
 * snapshot (null on the server and during hydration) and a value-less picker
 * starts on a fixed year until it resolves, so server and client markup
 * always match. Like upstream, the year/active month seed from the initial
 * value only. */
export interface DitherMonthPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(v: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}

// useSyncExternalStore inputs (stable identities): the current month as a
// primitive `YYYY-MM` key on the client, null on the server / hydration pass.
const subscribeNever = () => () => {};
const clientMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const serverMonth = () => null;

export function DitherMonthPicker({
  value = "",
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherMonthPickerProps) {
  const now = parse(useSyncExternalStore<string | null>(subscribeNever, clientMonth, serverMonth) ?? "");
  // null = follow the clock (upstream's `parse()` falls back to `new Date()`);
  // until it resolves a fixed year stands in.
  const [yearState, setYear] = useState<number | null>(() => parse(value)?.year ?? null);
  const [activeState, setActive] = useState<number | null>(() => parse(value)?.month ?? null);
  const year = yearState ?? now?.year ?? 2000;
  const active = activeState ?? now?.month ?? 0;

  function iso(month: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  function choose(month: number): void {
    setActive(month);
    onChange?.(iso(month));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    let next = active;
    if (e.key === "ArrowLeft") next = (active + 11) % 12;
    else if (e.key === "ArrowRight") next = (active + 1) % 12;
    else if (e.key === "ArrowUp")
      next = (active + 9) % 12; // three columns
    else if (e.key === "ArrowDown") next = (active + 3) % 12;
    else if (e.key === "PageUp") {
      e.preventDefault();
      setYear(year - 1);
      return;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setYear(year + 1);
      return;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
    onChange?.(iso(next));
  }

  return (
    <div
      {...rest}
      className={cn(
        "w-56 rounded-md border border-border bg-background/60 p-2",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous year"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          onClick={() => setYear(year - 1)}
        >
          ‹
        </button>
        <span className="text-[13px] font-medium tabular-nums">{year}</span>
        <button
          type="button"
          aria-label="Next year"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          onClick={() => setYear(year + 1)}
        >
          ›
        </button>
      </div>
      <div role="group" aria-label={`Months of ${year}`} className="grid grid-cols-3 gap-1" onKeyDown={onKeyDown}>
        {MONTHS.map((label, m) => (
          <button
            key={label}
            type="button"
            tabIndex={m === active ? 0 : -1}
            aria-pressed={iso(m) === value}
            className={cn(
              "rounded px-1 py-2 text-[12px] transition-colors motion-reduce:transition-none",
              iso(m) === value
                ? "bg-accent/20 text-foreground ring-1 ring-accent/60"
                : m === now?.month && year === now.year
                  ? "text-foreground ring-1 ring-foreground/30 hover:bg-accent/10"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            )}
            onClick={() => choose(m)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DitherMonthPicker;
