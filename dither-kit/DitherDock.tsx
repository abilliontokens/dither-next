"use client";

import { useEffect, useRef, useState } from "react";

import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Hover-magnifying dock — items swell on a gaussian falloff around the
 *  pointer and settle when it leaves. Reduced motion keeps the row still and
 *  marks hover by color alone. Port of Dock.vue. */

export type DockItem = { value: string; label: string; color?: PixelColor };

export interface DitherDockProps {
  items: DockItem[];
  /** Peak scale over the pointer. */
  magnify?: number;
  /** Falloff radius in px. */
  range?: number;
  className?: string;
  onSelect?: (value: string) => void;
}

export function DitherDock({
  items,
  magnify = 1.7,
  range = 80,
  className,
  onSelect,
}: DitherDockProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [px, setPx] = useState<number | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  function track(e: React.PointerEvent) {
    if (still) return;
    const r = barRef.current?.getBoundingClientRect();
    if (r) setPx(e.clientX - r.left);
  }

  function handlePointerLeave() {
    setPx(null);
  }

  function scaleOf(i: number): number {
    const pxVal = px;
    if (pxVal === null || !barRef.current) return 1;
    const buttons = barRef.current.querySelectorAll("button");
    const b = buttons[i] as HTMLElement | undefined;
    if (!b) return 1;
    const center = b.offsetLeft + b.offsetWidth / 2;
    const d = Math.abs(pxVal - center);
    const g = Math.exp(-(d * d) / (2 * range * range));
    return 1 + (magnify - 1) * g;
  }

  return (
    <div
      ref={barRef}
      className={cn(
        "inline-flex items-end gap-1.5 rounded-xl border border-border/60 bg-background/60 px-2 py-1.5",
        className,
      )}
      role="group"
      aria-label="Dock"
      onPointerMove={track}
      onPointerLeave={handlePointerLeave}
    >
      {items.map((it, i) => (
        <button
          key={it.value}
          type="button"
          aria-label={it.label}
          title={it.label}
          className="grid size-9 origin-bottom place-items-center rounded-lg border border-border/60 bg-card/60 transition-transform duration-150 ease-out will-change-transform hover:bg-card motion-reduce:transition-none"
          style={{ transform: `scale(${scaleOf(i)})` }}
          onClick={() => onSelect?.(it.value)}
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-[2px]"
            style={{ background: cssColor(it.color ?? "blue") }}
          />
        </button>
      ))}
    </div>
  );
}
