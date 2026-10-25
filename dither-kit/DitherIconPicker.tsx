"use client";

import { useId, useState, type HTMLAttributes } from "react";

import DitherIcon from "./DitherIcon";
import { ICON_NAMES } from "./icons";
import { cn } from "./lib";

/** Icon picker over the kit's own glyph set: a filter field over the names
 * and a radio grid (native radio semantics — arrow keys navigate the whole
 * grid, one tab stop). Value = the icon name.
 * Port of IconPicker.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * fixed `name="dk-icon-picker"` → per-instance `useId()` so same-page pickers
 * don't merge into one radio group; fallthrough attrs → `...rest` onto the root). */
export interface DitherIconPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  placeholder?: string;
  size?: number;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

export function DitherIconPicker({
  value,
  placeholder = "Filter icons…",
  size = 16,
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherIconPickerProps) {
  const [query, setQuery] = useState("");
  const groupName = useId();

  const q = query.trim().toLowerCase();
  const filtered = q === "" ? ICON_NAMES : ICON_NAMES.filter((n) => n.toLowerCase().includes(q));

  return (
    <div
      {...rest}
      className={cn(
        "grid gap-2 rounded-md border border-border bg-background/60 p-2",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-8 w-full rounded border border-border/70 bg-transparent px-2 py-1 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-accent/70 motion-reduce:transition-none"
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <div className="grid max-h-48 grid-cols-6 gap-1 overflow-auto sm:grid-cols-8">
        {filtered.map((name) => (
          <label
            key={name}
            title={name}
            className={cn(
              "grid aspect-square cursor-pointer place-items-center rounded border transition-colors motion-reduce:transition-none",
              value === name
                ? "border-accent/70 bg-accent/15 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <input
              className="sr-only"
              type="radio"
              name={groupName}
              value={name}
              checked={value === name}
              disabled={disabled}
              onChange={() => onChange?.(name)}
            />
            <DitherIcon name={name} size={size} />
          </label>
        ))}
        {filtered.length === 0 ? (
          <p className="col-span-full px-1 py-2 text-[12px] text-muted-foreground">No icons match “{query}”</p>
        ) : null}
      </div>
    </div>
  );
}

export default DitherIconPicker;
