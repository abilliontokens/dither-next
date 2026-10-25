import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherFocusRing — container-level focus highlight: wraps a control group and
 * shows the ring while anything inside holds focus (`focus-within`), so
 * keyboard users can see WHICH group is active — the individual control keeps
 * the global `:focus-visible` floor from the app styles. Port of FocusRing.vue.
 */
export interface DitherFocusRingProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DitherFocusRing({ className, children, ...rest }: DitherFocusRingProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-md focus-within:ring-2 focus-within:ring-foreground/70 focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default DitherFocusRing;
