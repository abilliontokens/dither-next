import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherText — text primitive on the site's native type scale. `as` picks the
 * element (p default; span/h3/li/… for context), `tone` maps to the shadcn
 * token utilities, `size` to the 11–15px scale the docs use — anything else
 * (leading, tracking, weight) rides along in `className`. Port of Text.vue.
 */
export interface DitherTextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: "default" | "muted" | "faint";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const TONES = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  faint: "text-muted-foreground/70",
} as const;

const SIZES = {
  xs: "text-[11px]",
  sm: "text-[12px]",
  md: "text-[13px]",
  lg: "text-[15px]",
} as const;

export function DitherText({ as: Tag = "p", tone = "default", size, className, children, ...rest }: DitherTextProps) {
  return (
    <Tag {...rest} className={cn(size && SIZES[size], TONES[tone], className)}>
      {children}
    </Tag>
  );
}

export default DitherText;
