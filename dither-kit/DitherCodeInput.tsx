"use client";

import type { KeyboardEvent } from "react";

import { DitherTextarea, type DitherTextareaProps } from "./DitherTextarea";
import { cn } from "./lib";

/** Code entry: monospace textarea where Tab indents (two spaces) and
 * Shift+Tab dedents the selected lines — the default browser tab trap is
 * the enemy of code fields, so it's handled here once.
 * Port of CodeInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `emit("submit")` → `onSubmit()`; `v-bind="$attrs"` → `...rest` onto the inner
 * DitherTextarea; a consumer `onKeyDown` runs before the Tab/submit handling, as
 * Vue merges fallthrough listeners). */
export interface DitherCodeInputProps extends Omit<DitherTextareaProps, "onSubmit"> {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

const TAB = "  ";

export function DitherCodeInput({
  value,
  onChange,
  onSubmit,
  placeholder = "// paste or type…",
  rows = 6,
  disabled,
  className,
  onKeyDown,
  ...rest
}: DitherCodeInputProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { value, selectionStart, selectionEnd } = el;
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const hadTab = value.startsWith(TAB, lineStart);
        const removed = hadTab ? TAB.length : 0;
        const next = value.slice(0, lineStart) + (hadTab ? value.slice(lineStart + removed) : value.slice(lineStart));
        onChange?.(next);
        requestAnimationFrame(() => {
          el.selectionStart = Math.max(lineStart, selectionStart - removed);
          el.selectionEnd = Math.max(lineStart, selectionEnd - removed);
        });
        return;
      }
      const next = value.slice(0, selectionStart) + TAB + value.slice(selectionEnd);
      onChange?.(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + TAB.length;
      });
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <DitherTextarea
      {...rest}
      value={value ?? ""}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn("font-mono text-[12.5px] leading-relaxed", className)}
      onChange={onChange}
      onKeyDown={handleKeyDown}
    />
  );
}

export default DitherCodeInput;
