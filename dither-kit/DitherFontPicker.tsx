"use client";

import { useId, type HTMLAttributes } from "react";

import { cn } from "./lib";

const FONT_STACKS: Array<{ label: string; stack: string }> = [
  { label: "System UI", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: "Geometric sans", stack: "'Futura', 'Century Gothic', 'Avenir', sans-serif" },
  { label: "Humanist sans", stack: "'Segoe UI', 'Frutiger', 'Helvetica Neue', sans-serif" },
  { label: "Old-style serif", stack: "'Charter', 'Georgia', 'Times New Roman', serif" },
  { label: "Transitional serif", stack: "'Libre Baskerville', 'Georgia', serif" },
  { label: "Monospace", stack: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace" },
  { label: "Console", stack: "'Lucida Console', 'Menlo', 'DejaVu Sans Mono', monospace" },
  { label: "Display", stack: "'Impact', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif" },
  { label: "Rounded", stack: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
  { label: "Handwriting", stack: "'Segoe Script', 'Comic Sans MS', cursive" },
];

/** Font stack picker: each option renders its own name in its own family so
 * the preview IS the choice — no separate swatch to drift. Value = the CSS
 * font stack string.
 * Port of FontPicker.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * fixed `name="dk-font-picker"` → per-instance `useId()` so same-page pickers
 * don't merge into one radio group; fallthrough attrs → `...rest` onto the root). */
export interface DitherFontPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

export function DitherFontPicker({ value, disabled = false, onChange, className, ...rest }: DitherFontPickerProps) {
  const groupName = useId();

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label="Font"
      className={cn(
        "grid gap-1 rounded-md border border-border bg-background/60 p-1.5",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {FONT_STACKS.map((font) => (
        <label
          key={font.stack}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-2 transition-colors motion-reduce:transition-none",
            value === font.stack
              ? "bg-accent/15 text-foreground"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
        >
          <input
            className="sr-only"
            type="radio"
            name={groupName}
            value={font.stack}
            checked={value === font.stack}
            disabled={disabled}
            onChange={() => onChange?.(font.stack)}
          />
          <span className="text-[13px]" style={{ fontFamily: font.stack }}>
            {font.label}
          </span>
          <span className="text-[11px] text-muted-foreground/70">Aa 123</span>
        </label>
      ))}
    </div>
  );
}

export default DitherFontPicker;
