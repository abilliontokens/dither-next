"use client";

import { useState, type HTMLAttributes, type KeyboardEvent } from "react";

import DitherIcon from "./DitherIcon";
import { cn } from "./lib";

/** Tags as chips in one field: Enter or comma commits, Backspace on an empty
 * input pulls the last chip back in, per-chip × removes. Trimmed, case-
 * deduped, `max`-capped (the oldest chip stays put when full).
 * Port of TagInput.vue (`update:modelValue` → `onChange`; the draft
 * `v-model` → local state). */
export interface DitherTagInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string[];
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  onChange?: (value: string[]) => void;
  className?: string;
}

export function DitherTagInput({
  value,
  placeholder = "Add tag…",
  max = Infinity,
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherTagInputProps) {
  const [draft, setDraft] = useState("");
  const tags = value ?? [];

  function add(raw: string): void {
    const tag = raw.trim();
    if (!tag || disabled) return;
    if (tags.length >= max) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange?.([...tags, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "") {
      if (tags.length > 0) onChange?.(tags.slice(0, -1));
    }
  }

  return (
    <div
      {...rest}
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded border border-border/70 bg-card px-1.5 py-0.5 text-[12px]"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
            onClick={() => onChange?.(tags.filter((_, j) => j !== i))}
          >
            <DitherIcon name="Close" size={10} />
          </button>
        </span>
      ))}
      {!disabled ? (
        <input
          value={draft}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-20 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
        />
      ) : null}
    </div>
  );
}

export default DitherTagInput;
