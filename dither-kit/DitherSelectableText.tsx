import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./lib";

/** Text that selects itself on click (`user-select: all`) — license keys,
 * tokens, one-tap copy targets. Wraps any inline content.
 * Port of SelectableText.vue. Pure render — no `"use client"`. */
export interface DitherSelectableTextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  className?: string;
}

export function DitherSelectableText({ as: Tag = "span", className, children, ...rest }: DitherSelectableTextProps) {
  return (
    <Tag {...rest} className={cn("select-all", className)}>
      {children}
    </Tag>
  );
}

export default DitherSelectableText;
