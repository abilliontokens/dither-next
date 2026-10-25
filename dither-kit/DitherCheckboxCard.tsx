"use client";

import type { LabelHTMLAttributes } from "react";

import { DitherCheckbox } from "./DitherCheckbox";
import { cn } from "./lib";

/** The whole card is the checkbox's label — title and description ride
 * along, one click anywhere toggles, the peer focus ring shows keyboard
 * focus. Checkbox stays the source of truth (native semantics preserved).
 * Port of CheckboxCard.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * fallthrough attrs → `...rest` onto the root label; default slot → `children`). */
export interface DitherCheckboxCardProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, "onChange"> {
  label?: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  className?: string;
}

export function DitherCheckboxCard({
  label = "",
  description,
  value,
  disabled = false,
  onChange,
  className,
  children,
  ...rest
}: DitherCheckboxCardProps) {
  return (
    <label
      {...rest}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-card/40 p-3 transition-colors hover:border-foreground/30 has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30 motion-reduce:transition-none",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <DitherCheckbox value={value ?? false} disabled={disabled} className="mt-0.5" onChange={onChange} />
      <span className="grid gap-1">
        {label ? <span className="text-[13px] font-medium leading-none text-foreground">{label}</span> : null}
        {description ? <span className="text-[12px] leading-snug text-muted-foreground">{description}</span> : null}
        <span className="text-[12px] leading-snug text-muted-foreground/70">{children}</span>
      </span>
    </label>
  );
}

export default DitherCheckboxCard;
