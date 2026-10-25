import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherBox — container primitive: one element, one job; `className` carries
 * the rest of the styling. `as` swaps the tag (div for blocks, span for inline
 * contexts, section/article for landmarks) without touching the children.
 * Unknown attrs (id, data-*, aria-*) fall through to the element untouched.
 * Port of Box.vue. Pure render — no `"use client"`.
 */
export interface DitherBoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  className?: string;
}

export function DitherBox({ as: Tag = "div", className, children, ...rest }: DitherBoxProps) {
  return (
    <Tag {...rest} className={cn("", className)}>
      {children}
    </Tag>
  );
}

export default DitherBox;
