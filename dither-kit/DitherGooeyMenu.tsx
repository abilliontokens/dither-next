"use client";

import { useId } from "react";
import { cssColor } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

export type GooeyItem = { value: string; label: string; color?: PixelColor };

const VEC: Record<"up" | "down" | "left" | "right", [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Action buttons that melt out of one trigger — the classic SVG goo filter
 * (blur + alpha contrast) fuses the circles while they travel. Reduced motion
 * drops the travel via `motion-reduce:transition-none`; items simply appear.
 *
 * Port of GooeyMenu.vue. The Vue module-level `gooeyCount` counter (used only
 * to mint a unique SVG filter id) becomes React's SSR-stable `useId()` — same
 * uniqueness guarantee without the server/client counter drift. The
 * `feGaussianBlur`/`feColorMatrix`/`feComposite` filter chain, the per-item
 * `i * 40ms` stagger, and the four directions carry across verbatim. */
export interface DitherGooeyMenuProps {
  items: GooeyItem[];
  /** Expanded state (was v-model:modelValue). */
  value?: boolean;
  direction?: "up" | "down" | "left" | "right";
  /** Gap between item centers, px. */
  spacing?: number;
  label?: string;
  className?: string;
  onSelect?: (value: string) => void;
  onChange?: (value: boolean) => void;
}

export function DitherGooeyMenu({
  items,
  value = false,
  direction = "up",
  spacing = 52,
  label = "Actions",
  className,
  onSelect,
  onChange,
}: DitherGooeyMenuProps) {
  // useId() mints a stable, SSR-safe id; strip its colons so the SVG url(#…)
  // filter reference has no fragment-unsafe characters.
  const id = `dk-goo-${useId().replace(/:/g, "")}`;

  function offset(i: number): string {
    if (!value) return "translate(0px, 0px)";
    const [vx, vy] = VEC[direction];
    const d = spacing * (i + 1);
    return `translate(${vx * d}px, ${vy * d}px)`;
  }

  function pick(itemValue: string): void {
    onSelect?.(itemValue);
    onChange?.(false);
  }

  return (
    <div
      className={cn("relative inline-block", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onChange?.(false);
      }}
    >
      <svg className="absolute size-0" aria-hidden="true">
        <defs>
          <filter id={id}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div style={{ filter: `url(#${id})` }}>
        {items.map((it, i) => (
          <button
            key={it.value}
            type="button"
            aria-label={it.label}
            title={it.label}
            tabIndex={value ? 0 : -1}
            className={cn(
              "absolute top-0 left-0 grid size-11 place-items-center rounded-full border border-border/60 bg-card transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
              CONTROL_BUTTON,
              value ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            style={{ transform: offset(i), transitionDelay: value ? `${i * 40}ms` : "0ms" }}
            onClick={() => pick(it.value)}
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-[2px]"
              style={{ background: cssColor(it.color ?? "blue") }}
            />
          </button>
        ))}
        <button
          type="button"
          aria-label={label}
          aria-expanded={value}
          className={cn(
            "relative grid size-11 place-items-center rounded-full border border-border/60 bg-card text-foreground",
            CONTROL_BUTTON,
          )}
          onClick={() => onChange?.(!value)}
        >
          <span
            aria-hidden="true"
            className={cn(
              "text-[15px] leading-none transition-transform duration-300 motion-reduce:transition-none",
              value ? "rotate-45" : "",
            )}
          >
            +
          </span>
        </button>
      </div>
    </div>
  );
}
