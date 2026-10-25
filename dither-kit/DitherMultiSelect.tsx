"use client";

import { useState, type HTMLAttributes } from "react";

import DitherIcon from "./DitherIcon";
import { DitherInput } from "./DitherInput";
import { cn } from "./lib";

/** Multi-select as chips + a filterable option list: native checkboxes carry
 * semantics (keyboard for free), the query narrows the pool, selected chips
 * stay visible and individually removable. `value` is the picked set.
 * Port of MultiSelect.vue (`update:modelValue` → `onChange`, `search` →
 * `onSearch`; fallthrough attrs → `...rest` onto the root). */
export interface DitherMultiSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  options?: string[];
  value?: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string[]) => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export function DitherMultiSelect({
  options,
  value,
  placeholder = "Search…",
  disabled = false,
  onChange,
  onSearch,
  className,
  ...rest
}: DitherMultiSelectProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const pool = options ?? [];
  const filtered = q === "" ? pool : pool.filter((o) => o.toLowerCase().includes(q));
  const selected = value ?? [];

  function toggle(option: string, checked: boolean) {
    const next = checked ? [...selected, option] : selected.filter((o) => o !== option);
    onChange?.(next);
  }

  return (
    <div
      {...rest}
      className={cn(
        "grid gap-2 rounded-md border border-border bg-background/60 p-2",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-card px-1.5 py-0.5 text-[12px]"
            >
              {option}
              <button
                type="button"
                aria-label={`Remove ${option}`}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
                onClick={() => onChange?.(selected.filter((o) => o !== option))}
              >
                <DitherIcon name="Close" size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <DitherInput
        type="search"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-8 py-1"
        onChange={(next) => {
          setQuery(next);
          onSearch?.(next);
        }}
      />

      <ul className="grid max-h-44 gap-0.5 overflow-auto">
        {filtered.length === 0 ? <li className="px-2 py-1.5 text-[12px] text-muted-foreground">No matches</li> : null}
        {filtered.map((option) => {
          const checked = selected.includes(option);
          return (
            <li key={option}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/10 motion-reduce:transition-none",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-[currentColor]"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggle(option, e.currentTarget.checked)}
                />
                {option}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DitherMultiSelect;
