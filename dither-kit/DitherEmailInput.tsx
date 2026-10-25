"use client";

import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Email field with the mobile keyboard and autofill contract baked in:
 * type=email, inputmode=email, autocomplete=email — the three things a bare
 * text input gets wrong.
 * Port of EmailInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `v-bind="$attrs"` → `...rest` onto the inner DitherInput). */
export interface DitherEmailInputProps extends Omit<DitherInputProps, "type" | "inputMode"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

export function DitherEmailInput({
  value,
  onChange,
  placeholder = "you@example.com",
  autoComplete = "email",
  disabled,
  invalid,
  className,
  ...rest
}: DitherEmailInputProps) {
  return (
    <DitherInput
      {...rest}
      type="email"
      inputMode="email"
      value={value ?? ""}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      invalid={invalid}
      className={cn(className)}
      onChange={onChange}
    />
  );
}

export default DitherEmailInput;
