import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherDivider — hairline rule. Horizontal renders a real `hr` (separator
 * semantics come for free); vertical is a flex-row citizen that stretches to
 * the row height. Both announce `role="separator"` with the right orientation.
 * Port of Divider.vue.
 */
export interface DitherDividerProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function DitherDivider({ orientation = "horizontal", className, ...rest }: DitherDividerProps) {
  const Tag = orientation === "vertical" ? "div" : "hr";
  return (
    <Tag
      {...rest}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === "vertical" ? "w-px self-stretch bg-border/60" : "h-px w-full border-0 bg-border/60",
        className,
      )}
    />
  );
}

export default DitherDivider;
