import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** The tiny uppercase eyebrow above section titles — 10px, open tracking,
 * muted; the editorial "OVERLINE" register.
 * Port of Overline.vue. Pure render — no `"use client"`. */
export interface DitherOverlineProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "muted" | "faint";
  className?: string;
}

export function DitherOverline({ tone = "muted", className, children, ...rest }: DitherOverlineProps) {
  return (
    <span
      {...rest}
      className={cn(
        "block text-[10px] uppercase tracking-[0.2em]",
        tone === "faint" ? "text-muted-foreground/70" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default DitherOverline;
