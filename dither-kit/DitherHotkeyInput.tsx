"use client";

import type { KeyboardEvent } from "react";

import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Shortcut capture: the field listens, modifiers hold until a non-modifier
 * arrives, Escape clears. Value shape: `Ctrl+Shift+K` (order Ctrl, Alt,
 * Shift, Meta + normalized key). Repeat keys are ignored so holding a combo
 * doesn't re-fire.
 * Port of HotkeyInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `v-bind="$attrs"` → `...rest` onto the inner DitherInput; a consumer
 * `onKeyDown` runs before the capture logic, as Vue merges fallthrough
 * listeners). */
export interface DitherHotkeyInputProps extends Omit<DitherInputProps, "readOnly"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MODIFIERS = new Set(["Control", "Shift", "Alt", "Meta", "CapsLock", "OS"]);

function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function DitherHotkeyInput({
  value,
  onChange,
  placeholder = "Press a shortcut…",
  disabled,
  className,
  onKeyDown,
  ...rest
}: DitherHotkeyInputProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (disabled) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onChange?.("");
      return;
    }
    if (MODIFIERS.has(e.key) || e.repeat) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");
    parts.push(normalizeKey(e.key));
    onChange?.(parts.join("+"));
  }

  return (
    <DitherInput
      {...rest}
      readOnly
      value={value ?? ""}
      placeholder={value ? "" : placeholder}
      disabled={disabled}
      className={cn("cursor-default", className)}
      onKeyDown={handleKeyDown}
    />
  );
}

export default DitherHotkeyInput;
