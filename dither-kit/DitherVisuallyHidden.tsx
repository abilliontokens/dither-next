import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherVisuallyHidden — screen-reader-only content. `focusable` reveals it on
 * keyboard focus with skip-link styling — the pattern for "visible only to
 * whom it matters", and the a11y-floor alternative to `aria-label` when the
 * label must also exist in the reading order. Port of VisuallyHidden.vue.
 */
export interface DitherVisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  focusable?: boolean;
  className?: string;
}

export function DitherVisuallyHidden({ focusable = false, className, children, ...rest }: DitherVisuallyHiddenProps) {
  return (
    <span
      {...rest}
      className={cn(
        "sr-only",
        focusable &&
          "focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:border focus:bg-background focus:px-2 focus:py-1 focus:text-[11px] focus:text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default DitherVisuallyHidden;
