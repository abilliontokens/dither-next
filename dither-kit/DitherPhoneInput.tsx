"use client";

import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Phone field: digits normalized into the (415) 555-2671 shape as you type
 * (10-digit NANP input), tel keyboard on mobile. The model is always the
 * formatted string; caret editing is end-anchored by design.
 * Port of PhoneInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `autocomplete` → `autoComplete`; `v-bind="$attrs"` → `...rest` onto the inner
 * DitherInput). */
export interface DitherPhoneInputProps extends Omit<DitherInputProps, "type" | "inputMode"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
}

function format(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function DitherPhoneInput({
  value,
  onChange,
  placeholder = "(555) 123-4567",
  autoComplete = "tel",
  disabled,
  className,
  ...rest
}: DitherPhoneInputProps) {
  return (
    <DitherInput
      {...rest}
      type="tel"
      inputMode="tel"
      value={value ?? ""}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className={cn(className)}
      onChange={(v) => onChange?.(format(v))}
    />
  );
}

export default DitherPhoneInput;
