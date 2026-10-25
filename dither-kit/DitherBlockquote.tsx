import type { BlockquoteHTMLAttributes } from "react";

import { cn } from "./lib";

/** Quoted aside: real `<blockquote>` semantics with the editorial treatment —
 * hairline left rule, muted register. Cite lives in the children (or the
 * `cite` attr). Port of Blockquote.vue. Pure render — no `"use client"`. */
export interface DitherBlockquoteProps extends BlockquoteHTMLAttributes<HTMLQuoteElement> {
  className?: string;
}

export function DitherBlockquote({ className, children, ...rest }: DitherBlockquoteProps) {
  return (
    <blockquote
      {...rest}
      className={cn("border-l-2 border-border/60 pl-4 text-[13px] leading-relaxed text-muted-foreground", className)}
    >
      {children}
    </blockquote>
  );
}

export default DitherBlockquote;
