"use client";

import { cssColor } from "./palette";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Morphing status pill — a compact row that stays visible while the detail
 *  panel unfolds beneath it through the house 0fr → 1fr grid trick. Escape
 *  collapses; reduced motion snaps. Port of Island.vue. */

export interface DitherIslandProps {
  /** Expanded state (controlled). */
  value?: boolean;
  label?: string;
  color?: PixelColor;
  /** Pulse the status dot while collapsed. */
  live?: boolean;
  className?: string;
  /** Named slot for the compact row content. */
  compact?: React.ReactNode;
  /** Default slot for the detail panel content. */
  children?: React.ReactNode;
  onChange?: (value: boolean) => void;
}

export function DitherIsland({
  value = false,
  label = "Status",
  color = "green",
  live = true,
  className,
  compact,
  children,
  onChange,
}: DitherIslandProps) {
  const expanded = value ?? false;

  function toggle() {
    onChange?.(!expanded);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onChange?.(false);
    }
  }

  return (
    <div
      className={cn(
        "inline-block overflow-hidden rounded-2xl border border-border/60 bg-background/80 font-mono",
        className,
      )}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-card/40"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full motion-reduce:animate-none",
            live && !expanded ? "animate-pulse" : "",
          )}
          style={{ background: cssColor(color) }}
        />
        {compact ?? label}
        <span
          aria-hidden="true"
          className={cn(
            "ml-auto pl-3 text-[10px] text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            expanded ? "rotate-180" : "",
          )}
        >
          ▾
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden" inert={!expanded}>
          <div className="border-t border-border/40 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
