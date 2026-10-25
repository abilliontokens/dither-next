"use client";

import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Chip-style choice group: the chip is the LABEL of a real radio (or
 * checkbox when `multiple`), so native keyboard semantics and focus come for
 * free — no roving tabindex to get wrong. `value` is a string for single and
 * a string array for multiple.
 * Port of ChoiceChips.vue (`emit("update:modelValue", v)` → `onChange(v)`;
 * fallthrough attrs → `...rest` onto the root group). */
export interface DitherChoiceChipsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  options?: string[];
  value?: string | string[];
  multiple?: boolean;
  disabled?: boolean;
  onChange?: (value: string | string[]) => void;
  className?: string;
}

export function DitherChoiceChips({
  options = [],
  value,
  multiple,
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherChoiceChipsProps) {
  const selected = multiple ? (Array.isArray(value) ? value : []) : typeof value === "string" ? value : "";

  function handleChange(option: string, checked: boolean) {
    if (multiple) {
      const set = new Set(selected);
      if (checked) set.add(option);
      else set.delete(option);
      onChange?.([...set]);
    } else {
      onChange?.(option);
    }
  }

  return (
    <div
      {...rest}
      role="group"
      className={cn("flex flex-wrap gap-1.5", className)}
      aria-disabled={disabled || undefined}
    >
      {options.map((option) => {
        const checked = multiple ? selected.includes(option) : selected === option;
        return (
          <label
            key={option}
            className={cn(
              "cursor-pointer select-none rounded-full border px-3 py-1.5 text-[12px] transition-colors motion-reduce:transition-none",
              checked
                ? "border-accent/70 bg-accent/15 text-foreground"
                : "border-border/70 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            <input
              className="sr-only"
              type={multiple ? "checkbox" : "radio"}
              value={option}
              checked={checked}
              disabled={disabled}
              onChange={(e) => handleChange(option, e.currentTarget.checked)}
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

export default DitherChoiceChips;
