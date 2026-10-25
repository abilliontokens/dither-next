import type { LabelHTMLAttributes } from "react";

import { cn } from "./lib";

/** A real `<label>` — pairs with controls through `htmlFor` (or by nesting),
 * which is the whole point over a styled span. Port of Label.vue. Pure render
 * — no `"use client"`. */
export interface DitherLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  className?: string;
}

export function DitherLabel({ required = false, className, children, ...rest }: DitherLabelProps) {
  return (
    <label {...rest} className={cn("inline-flex items-center gap-1 text-[12px] text-foreground", className)}>
      {children}
      {required ? (
        <span className="text-muted-foreground" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export default DitherLabel;
