"use client";

import { cssColor } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** An accent tile that expands into a dotted-arrow trail on hover or focus —
 * the trail is stamped by a repeating radial gradient in the accent hue and
 * the head tile nudges forward. Reduced motion reveals the trail instantly via
 * `motion-reduce:transition-none`.
 *
 * Port of ExpandingArrow.vue. Pure render (no state/hooks); the trail grow and
 * the tile nudge are entirely CSS-driven through `group-hover`/
 * `group-focus-visible`. The radial-gradient dot stamp (`1.5px` dot on a
 * `6px 3px` cell) and the `translate-x-0.5` nudge carry across verbatim. */
export interface DitherExpandingArrowProps {
  color?: PixelColor;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DitherExpandingArrow({
  color = "blue",
  disabled = false,
  className,
  children,
}: DitherExpandingArrowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "group inline-flex items-center gap-3 rounded-md border border-border/60 bg-card/60 py-1.5 pr-1.5 pl-3.5 font-mono text-[12px] text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:text-foreground",
        CONTROL_BUTTON,
        className,
      )}
    >
      {children ?? "Explore the kit"}
      <span aria-hidden="true" className="flex items-center">
        <span
          className="h-[3px] w-0 opacity-0 transition-[width,opacity] duration-300 ease-out group-hover:w-9 group-hover:opacity-100 group-focus-visible:w-9 group-focus-visible:opacity-100 motion-reduce:transition-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${cssColor(color)} 1.5px, transparent 1.5px)`,
            backgroundSize: "6px 3px",
            backgroundPosition: "center",
          }}
        />
        <span
          className="grid size-8 shrink-0 place-items-center rounded-md text-[14px] text-background transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
          style={{ background: cssColor(color) }}
        >
          →
        </span>
      </span>
    </button>
  );
}
