import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherSpacer — sized empty space for flex/grid rows, the alternative to
 * magic margins. `axis="y"` (default) is vertical room, `axis="x"` is
 * horizontal. Purely decorative: always aria-hidden. Port of Spacer.vue.
 */
export interface DitherSpacerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  axis?: "x" | "y";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Literal class strings so Tailwind ships every variant.
const SPACE = {
  xs: { y: "h-[4px]", x: "w-[4px]" },
  sm: { y: "h-[8px]", x: "w-[8px]" },
  md: { y: "h-[16px]", x: "w-[16px]" },
  lg: { y: "h-[24px]", x: "w-[24px]" },
  xl: { y: "h-[40px]", x: "w-[40px]" },
} as const;

export function DitherSpacer({ axis = "y", size = "md", className, ...rest }: DitherSpacerProps) {
  return <div {...rest} aria-hidden="true" className={cn(SPACE[size][axis], "shrink-0", className)} />;
}

export default DitherSpacer;
