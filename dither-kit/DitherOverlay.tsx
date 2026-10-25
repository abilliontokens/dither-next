import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherOverlay — full-cover layer primitive: fixed dim over the app (dialogs,
 * drawers, busy states). Decorative and click-transparent by default; flip
 * `interactive` to make it catch pointer events (dismissable scrims), which
 * also lifts the aria-hidden so its children stay reachable.
 * Port of Overlay.vue.
 */
export interface DitherOverlayProps extends HTMLAttributes<HTMLDivElement> {
  dim?: "none" | "soft" | "medium" | "strong";
  interactive?: boolean;
  className?: string;
}

const DIMS = {
  none: "",
  soft: "bg-background/20",
  medium: "bg-background/40",
  strong: "bg-background/60",
} as const;

export function DitherOverlay({ dim = "soft", interactive = false, className, children, ...rest }: DitherOverlayProps) {
  return (
    <div
      {...rest}
      className={cn(
        "fixed inset-0 z-40",
        DIMS[dim],
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
      aria-hidden={interactive ? undefined : "true"}
    >
      {children}
    </div>
  );
}

export default DitherOverlay;
