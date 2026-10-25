"use client";

import { useState } from "react";

import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Money entry: the model stays a plain decimal string ("1234.56"), the
 * DISPLAY groups thousands while blurred and shows raw digits while focused
 * so the caret and typing stay predictable. One dot, digits only.
 * Port of CurrencyInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `computed` display → derived in render; `v-bind="$attrs"` → `...rest` onto the
 * inner DitherInput; a consumer `onFocus`/`onBlur` runs before the focus
 * tracking, as Vue merges fallthrough listeners). */
export interface DitherCurrencyInputProps extends Omit<DitherInputProps, "inputMode" | "prefix"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  locale?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

function sanitize(raw: string): string {
  const oneDot = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  const [whole = "", ...rest] = oneDot.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function DitherCurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  prefix = "$",
  locale = "en-US",
  disabled,
  invalid,
  className,
  onFocus,
  onBlur,
  ...rest
}: DitherCurrencyInputProps) {
  const [focused, setFocused] = useState(false);

  const display = (() => {
    if (focused) return value ?? "";
    const raw = value ?? "";
    if (raw === "") return "";
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: raw.includes(".") ? Math.min(raw.split(".")[1].length, 2) : 0,
      maximumFractionDigits: 2,
    }).format(n);
  })();

  return (
    <div className="relative">
      {prefix ? (
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground"
          aria-hidden="true"
        >
          {prefix}
        </span>
      ) : null}
      <DitherInput
        {...rest}
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        className={cn("text-right tabular-nums", prefix && "pl-7", className)}
        onFocus={(e) => {
          onFocus?.(e);
          setFocused(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setFocused(false);
        }}
        onChange={(v) => onChange?.(sanitize(v))}
      />
    </div>
  );
}

export default DitherCurrencyInput;
