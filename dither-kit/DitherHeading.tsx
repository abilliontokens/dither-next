import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Semantic heading with the site's scale baked in: h1–h6 pick their own
 * size/weight from the level, `className` overrides anything below.
 * Port of Heading.vue. Pure render — no `"use client"`. */
export type DitherHeadingLevel = "1" | "2" | "3" | "4" | "5" | "6";

export interface DitherHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: DitherHeadingLevel;
  className?: string;
}

const LEVELS = {
  "1": "text-2xl tracking-tight font-medium",
  "2": "text-lg tracking-tight font-medium",
  "3": "text-base tracking-tight font-medium",
  "4": "text-sm font-medium",
  "5": "text-[13px] font-medium",
  "6": "text-[12px] font-medium",
} as const;

export function DitherHeading({ level = "2", className, children, ...rest }: DitherHeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag {...rest} className={cn(LEVELS[level], className)}>
      {children}
    </Tag>
  );
}

export default DitherHeading;
