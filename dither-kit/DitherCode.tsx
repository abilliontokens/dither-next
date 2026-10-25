import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Inline code — the `<code>` element in house chrome (small radius, card
 * fill). For the copyable, highlighted block see DitherCodeBlock.
 * Port of Code.vue. Pure render — no `"use client"`. */
export interface DitherCodeProps extends HTMLAttributes<HTMLElement> {
  className?: string;
}

export function DitherCode({ className, children, ...rest }: DitherCodeProps) {
  return (
    <code
      {...rest}
      className={cn(
        "rounded border border-border/60 bg-card/60 px-1 py-px font-mono text-[12px] text-foreground/90",
        className,
      )}
    >
      {children}
    </code>
  );
}

export default DitherCode;
