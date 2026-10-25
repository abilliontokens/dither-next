import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./lib";

/** Clamped block with a real ellipsis after N lines (1–6).
 * Port of LineClamp.vue. Pure render — no `"use client"`. */
export interface DitherLineClampProps extends HTMLAttributes<HTMLElement> {
  lines?: 1 | 2 | 3 | 4 | 5 | 6;
  as?: ElementType;
  className?: string;
}

// Literal classes so Tailwind ships every variant.
const CLAMPS = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
} as const;

export function DitherLineClamp({ lines = 3, as: Tag = "p", className, children, ...rest }: DitherLineClampProps) {
  return (
    <Tag {...rest} className={cn(CLAMPS[lines], className)}>
      {children}
    </Tag>
  );
}

export default DitherLineClamp;
