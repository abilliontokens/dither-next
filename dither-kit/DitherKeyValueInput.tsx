"use client";

import type { HTMLAttributes } from "react";

import DitherIcon from "./DitherIcon";
import { DitherInput } from "./DitherInput";
import { cn } from "./lib";

export interface DitherKeyValueRow {
  key: string;
  value: string;
}

/** Repeatable key/value rows — headers, metadata, query params. Every edit
 * emits the whole array (the parent owns the source of truth); empty rows
 * are the caller's to keep or prune.
 * Port of KeyValueInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `KeyValueRow` exported as `DitherKeyValueRow`; fallthrough attrs → `...rest`
 * onto the root). */
export interface DitherKeyValueInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: DitherKeyValueRow[];
  disabled?: boolean;
  onChange?: (value: DitherKeyValueRow[]) => void;
  className?: string;
}

export function DitherKeyValueInput({
  value,
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherKeyValueInputProps) {
  function clone(): DitherKeyValueRow[] {
    return (value ?? []).map((r) => ({ ...r }));
  }

  function updateRow(index: number, field: keyof DitherKeyValueRow, text: string) {
    const next = clone();
    if (!next[index]) return;
    next[index][field] = text;
    onChange?.(next);
  }

  return (
    <div {...rest} className={cn("grid gap-2", className)}>
      {(value ?? []).map((row, i) => (
        <div key={i} className={cn("flex items-center gap-2", disabled && "opacity-40")}>
          <DitherInput
            value={row.key}
            placeholder="key"
            disabled={disabled}
            className="w-1/3 font-mono text-[12.5px]"
            onChange={(text) => updateRow(i, "key", text)}
          />
          <DitherInput
            value={row.value}
            placeholder="value"
            disabled={disabled}
            className="flex-1"
            onChange={(text) => updateRow(i, "value", text)}
          />
          <button
            type="button"
            aria-label={`Remove row ${i + 1}`}
            disabled={disabled}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none motion-reduce:transition-none"
            onClick={() => onChange?.(clone().filter((_, j) => j !== i))}
          >
            <DitherIcon name="Close" size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        className="justify-self-start rounded border border-dashed border-border/70 px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
        onClick={() => onChange?.([...clone(), { key: "", value: "" }])}
      >
        + Add row
      </button>
    </div>
  );
}

export default DitherKeyValueInput;
