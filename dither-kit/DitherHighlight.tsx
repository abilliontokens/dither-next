import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Inline highlight: the `<mark>` element with a neutral token wash (the
 * colored variants ride in `className`). Neutral because house color comes
 * from palette seeds, not hardcoded accents. Port of Highlight.vue. Pure
 * render — no `"use client"`. */
export interface DitherHighlightProps extends HTMLAttributes<HTMLElement> {
  className?: string;
}

export function DitherHighlight({ className, children, ...rest }: DitherHighlightProps) {
  return (
    <mark {...rest} className={cn("rounded-sm bg-foreground/10 px-0.5 text-inherit", className)}>
      {children}
    </mark>
  );
}

export default DitherHighlight;
