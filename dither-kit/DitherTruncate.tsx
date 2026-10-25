import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./lib";

/** One-line ellipsis. Wraps any content in the `truncate` contract —
 * `title` rides through as an attr so native tooltips stay available.
 * Port of Truncate.vue. Pure render — no `"use client"`. */
export interface DitherTruncateProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  className?: string;
}

export function DitherTruncate({ as: Tag = "span", className, children, ...rest }: DitherTruncateProps) {
  return (
    <Tag {...rest} className={cn("block truncate", className)}>
      {children}
    </Tag>
  );
}

export default DitherTruncate;
