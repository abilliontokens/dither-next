"use client";

import { useId, useState, type HTMLAttributes, type KeyboardEvent } from "react";

import { cn } from "./lib";

/** Single-select listbox with roving focus (the WAI-ARIA keyboard contract):
 * arrows move, Home/End jump, Enter/Space select, the active option carries
 * `aria-activedescendant`. Options are plain strings; `value` is the picked
 * one. Emits `select` on commit so click-vs-keyboard converge.
 * Port of ListBox.vue (`update:modelValue` → `onChange`, `select` → `onSelect`;
 * `Math.random()` root id → `useId()` for hydration-stable option ids;
 * fallthrough attrs → `...rest` onto the root `<ul>`, a consumer `onKeyDown`
 * runs before the roving logic). */
export interface DitherListBoxProps extends Omit<HTMLAttributes<HTMLUListElement>, "onChange" | "onSelect"> {
  options?: string[];
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  className?: string;
}

export function DitherListBox({
  options = [],
  value,
  disabled = false,
  onChange,
  onSelect,
  className,
  onKeyDown,
  ...rest
}: DitherListBoxProps) {
  const [active, setActive] = useState(-1);
  const rootId = useId();

  function choose(i: number) {
    const option = options[i];
    if (option === undefined) return;
    setActive(i);
    onChange?.(option);
    onSelect?.(option);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(options.length - 1, active + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, active - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active >= 0) choose(active);
    }
  }

  return (
    <ul
      {...rest}
      role="listbox"
      aria-activedescendant={active >= 0 ? `${rootId}-opt-${active}` : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "grid max-h-56 w-full overflow-auto rounded-md border border-border bg-background/60 p-1 outline-none focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/20",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        handleKeyDown(e);
      }}
    >
      {options.map((option, i) => (
        <li
          id={`${rootId}-opt-${i}`}
          key={option}
          role="option"
          aria-selected={option === value}
          className={cn(
            "cursor-pointer rounded px-2.5 py-1.5 text-[13px] transition-colors motion-reduce:transition-none",
            option === value
              ? "bg-accent/15 text-foreground"
              : i === active
                ? "bg-accent/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
          )}
          onMouseMove={() => setActive(i)}
          onClick={() => choose(i)}
        >
          {option}
        </li>
      ))}
    </ul>
  );
}

export default DitherListBox;
