"use client";

import { useState } from "react";

import DitherIcon from "./DitherIcon";
import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Password field with a reveal toggle: type flips text/password, the button
 * carries the accessible name and never submits (type=button).
 * Port of PasswordInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `v-bind="$attrs"` → `...rest` onto the inner DitherInput; `className` lands on
 * the DitherInput as upstream's `props.class` does). */
export interface DitherPasswordInputProps extends Omit<DitherInputProps, "type"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

export function DitherPasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  className,
  ...rest
}: DitherPasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <DitherInput
        {...rest}
        value={value ?? ""}
        type={shown ? "text" : "password"}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        className={cn("pr-9", className)}
        onChange={onChange}
      />
      <button
        type="button"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setShown((s) => !s)}
      >
        <DitherIcon name={shown ? "EyeOff" : "Eye"} size={14} />
      </button>
    </div>
  );
}

export default DitherPasswordInput;
