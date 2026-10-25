import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Supporting text under a title or figure — the caption register of the
 * type scale (11px, muted), with `faint` for the quietest tier.
 * Port of Caption.vue. Pure render — no `"use client"`. */
export interface DitherCaptionProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "muted" | "faint";
  className?: string;
}

export function DitherCaption({ tone = "muted", className, children, ...rest }: DitherCaptionProps) {
  return (
    <span
      {...rest}
      className={cn(
        "block text-[11px]",
        tone === "faint" ? "text-muted-foreground/70" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default DitherCaption;
