"use client";

import { useEffect, useRef, useState } from "react";

import { POPOVER } from "./control";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import type { PixelColor } from "./pixel";
import { cn } from "./lib";

export type PreviewRailItem = {
  value: string;
  label: string;
  hint?: string;
  color?: PixelColor;
};

/**
 * DitherPreviewRail — Codex-style navigation rail. Verbatim port of
 * PreviewRail.vue.
 *
 * Compact ticks swell into a pyramid around the pointer and float a
 * destination preview beside the hovered or focused tick. Reduced motion keeps
 * the ticks still; the preview remains.
 *
 * `modelValue` → `value`/`onChange`. `py`/`focusIndex` are reactive in Vue, so
 * they are `useState` here (pointer tracking must re-render the widths). The
 * `py = ref(null)` is the only place a pointer handler writes re-rendering
 * state — `DitherDock`'s sibling port stores it in a ref and never re-renders,
 * which is wrong for a rail that must swell live.
 *
 * `still` is the SSR-safe reduced-motion read: `false` on the server/first
 * paint, corrected in an effect (guide §9, matches DitherDock).
 */
export interface DitherPreviewRailProps {
  items: PreviewRailItem[];
  value?: string;
  /** Pyramid falloff radius in px. */
  range?: number;
  /** Screen edge the rail hugs; the preview floats toward the other side. */
  side?: "left" | "right";
  /** Scoped `preview` slot → render prop receiving the previewed item. */
  renderPreview?: (item: PreviewRailItem) => React.ReactNode;
  className?: string;
  onChange?: (value: string) => void;
}

export function DitherPreviewRail({
  items,
  value,
  range = 56,
  side = "left",
  renderPreview,
  className,
  onChange,
}: DitherPreviewRailProps) {
  const rail = useRef<HTMLElement | null>(null);
  const [py, setPy] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  function track(e: React.PointerEvent): void {
    const r = rail.current?.getBoundingClientRect();
    if (r) setPy(e.clientY - r.top);
  }

  function onFocusin(e: React.FocusEvent): void {
    const b = (e.target as HTMLElement).closest("button");
    setFocusIndex(b ? Number((b as HTMLElement).dataset.i) : null);
  }

  // DOM measurements read during render (offsetTop/offsetHeight). SSR-safe:
  // `rail.current` is null on the server → returns null → fallback values.
  function centerOf(i: number): number | null {
    const b = rail.current?.querySelectorAll("button")[i] as HTMLElement | undefined;
    return b ? b.offsetTop + b.offsetHeight / 2 : null;
  }

  function widthOf(i: number): number {
    const rest = items[i]?.value === value ? 16 : 10;
    if (still || py === null) return rest;
    const c = centerOf(i);
    const w = c === null ? 0 : Math.max(0, 1 - Math.abs(py - c) / range);
    return rest + 16 * w;
  }

  let previewIndex: number | null = null;
  if (focusIndex !== null) {
    previewIndex = focusIndex;
  } else if (py !== null) {
    let bd = Infinity;
    for (let i = 0; i < items.length; i++) {
      const c = centerOf(i);
      if (c === null) continue;
      const d = Math.abs(py - c);
      if (d < bd) {
        bd = d;
        previewIndex = i;
      }
    }
  }
  const preview = previewIndex === null ? null : items[previewIndex] ?? null;
  const previewTop = previewIndex === null ? 0 : centerOf(previewIndex) ?? 0;

  return (
    <nav
      ref={rail}
      className={cn("relative inline-flex flex-col gap-1 py-1", className)}
      aria-label="Preview rail"
      onPointerMove={track}
      onPointerLeave={() => setPy(null)}
      onFocus={onFocusin}
      onBlur={() => setFocusIndex(null)}
    >
      {items.map((it, i) => (
        <button
          key={it.value}
          type="button"
          data-i={i}
          aria-label={it.hint ? `${it.label} — ${it.hint}` : it.label}
          aria-current={it.value === value ? "page" : undefined}
          className={cn(
            "flex h-4 w-9 items-center rounded-md px-1 hover:bg-card/60",
            side === "right" ? "justify-end" : "justify-start",
          )}
          onClick={() => onChange?.(it.value)}
        >
          <span
            aria-hidden="true"
            className="h-0.5 rounded-full bg-foreground/30 transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{
              width: `${widthOf(i)}px`,
              ...(it.value === value ? { background: cssColor(it.color ?? "blue") } : {}),
            }}
          />
        </button>
      ))}
      {preview ? (
        <div
          aria-hidden="true"
          className={cn(
            POPOVER,
            "pointer-events-none absolute z-10 whitespace-nowrap px-3 py-2 transition-[top] duration-150 ease-out motion-reduce:transition-none",
            side === "right" ? "right-full mr-2" : "left-full ml-2",
          )}
          style={{ top: `${previewTop}px`, transform: "translateY(-50%)" }}
        >
          {renderPreview ? (
            renderPreview(preview)
          ) : (
            <>
              <div className="text-[12px] font-medium text-foreground">{preview.label}</div>
              {preview.hint ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{preview.hint}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
