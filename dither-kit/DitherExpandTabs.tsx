"use client";

import { cssColor } from "./palette";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

export type ExpandTab = { value: string; label: string; color?: PixelColor };

/** Icon bar where only the active tab unfolds its label — the rest stay
 *  square glyphs. The label slides through a 0fr → 1fr column, the house
 *  grid trick, stilled under reduced motion. Port of ExpandTabs.vue. */

export interface DitherExpandTabsProps {
  tabs: ExpandTab[];
  /** Active tab value (controlled). */
  value: string;
  color?: PixelColor;
  className?: string;
  onChange?: (value: string) => void;
}

export function DitherExpandTabs({
  tabs,
  value,
  color = "blue",
  className,
  onChange,
}: DitherExpandTabsProps) {
  function select(tabValue: string) {
    onChange?.(tabValue);
  }

  const hue = (t: ExpandTab) => cssColor(t.color ?? color);

  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-lg border border-border/60 bg-background/40 p-1",
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-8 items-center gap-0 rounded-md px-2.5 font-mono text-[12px] transition-colors",
              active
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
            onClick={() => select(t.value)}
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-[1px]"
              style={{
                background: active ? hue(t) : "currentColor",
                opacity: active ? 1 : 0.7,
              }}
            />
            <span
              className="grid transition-[grid-template-columns] duration-200 motion-reduce:transition-none"
              style={{
                gridTemplateColumns: active ? "1fr" : "0fr",
              }}
            >
              <span
                className={cn(
                  "min-w-0 overflow-hidden whitespace-nowrap",
                  active ? "pl-2" : "",
                )}
              >
                {t.label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
