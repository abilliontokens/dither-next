"use client";

import { useRef, useState, type HTMLAttributes } from "react";

import { DitherCalendar } from "./DitherCalendar";
import { DitherClickOutside } from "./DitherClickOutside";
import DitherIcon from "./DitherIcon";
import { cn } from "./lib";

/** Date field + calendar popover: the input shows the ISO value in a human
 * format, the calendar opens on click/focus, select closes, Escape and
 * outside-click dismiss (ClickOutside, capture-phase). The model stays ISO
 * YYYY-MM-DD.
 * Port of DatePicker.vue (`update:modelValue` → `onChange`, `select` →
 * `onSelect`; fallthrough attrs land on the DitherClickOutside root as in Vue).
 * Two fixes: the human label parses the ISO day as UTC midnight (upstream
 * formats local midnight in UTC, which shows the previous day east of UTC and
 * differs between server and client), and a pointer press no longer lets the
 * focus-open be undone by the click toggle of the same press (focus still
 * opens for keyboard users; click still toggles). */
export interface DitherDatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "onSelect"> {
  value?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  className?: string;
}

const HUMAN = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function DitherDatePicker({
  value,
  placeholder = "YYYY-MM-DD",
  min,
  max,
  disabled = false,
  onChange,
  onSelect,
  className,
  ...rest
}: DitherDatePickerProps) {
  const [open, setOpen] = useState(false);
  // A pointer press focuses the trigger (focus opens) and then clicks it (click
  // toggles) — without this flag the same press would open and close it.
  const pressing = useRef(false);

  const human = !value
    ? ""
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? HUMAN.format(new Date(`${value}T00:00:00Z`))
      : value;

  return (
    <DitherClickOutside {...rest} enabled={open} onOutside={() => setOpen(false)}>
      <div
        className={cn("relative", className)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          setOpen(false);
        }}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-left font-mono text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-foreground/25 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
          onPointerDown={() => {
            pressing.current = true;
          }}
          onClick={() => {
            pressing.current = false;
            setOpen((o) => !o);
          }}
          onFocus={() => {
            if (!pressing.current) setOpen(true);
          }}
          onBlur={() => {
            pressing.current = false;
          }}
        >
          <span className={cn("flex-1", !value && "text-muted-foreground/60")}>{human || placeholder}</span>
          <DitherIcon name="Calendar" size={14} className="shrink-0 text-muted-foreground" />
        </button>
        {open ? (
          <div role="dialog" aria-label="Pick a date" className="absolute left-0 top-full z-30 mt-1 shadow-lg">
            <DitherCalendar
              value={value}
              min={min}
              max={max}
              onChange={onChange}
              onSelect={(picked) => {
                onSelect?.(picked);
                setOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
    </DitherClickOutside>
  );
}

export default DitherDatePicker;
