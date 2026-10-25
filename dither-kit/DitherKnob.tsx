"use client";

import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from "react";

import { cn, deg } from "./lib";

/** Rotary knob: drag VERTICALLY to change the value (the reliable gesture —
 * angle-following wraps badly at the detent), keyboard arrows/PageUp-Down/
 * Home-End, `role="slider"` semantics. Indicator line rotates across a 270°
 * sweep from -135°.
 * Port of Knob.vue (`update:modelValue` → `onChange`; `onBeforeUnmount(stopDrag)`
 * → effect cleanup). The window drag listeners read the latest props through a
 * ref, as Vue's handlers read live props; the rotation is rounded for
 * hydration parity. */
export interface DitherKnobProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

function clampSnap(next: number, min: number, max: number, step: number): number {
  const snapped = Math.round(next / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function DitherKnob({
  value = 50,
  min = 0,
  max = 100,
  step = 1,
  size = 72,
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherKnobProps) {
  const span = max - min;
  const ratio = span === 0 ? 0 : (value - min) / span;
  const angle = -135 + ratio * 270;

  const latest = useRef({ min, max, step, onChange });
  latest.current = { min, max, step, onChange };
  const drag = useRef({ startY: 0, startVal: 0, dragging: false });

  // Stable listener identities so removeEventListener always matches.
  const listeners = useRef<{ move: (e: globalThis.PointerEvent) => void; stop: () => void } | null>(null);
  if (!listeners.current) {
    const move = (e: globalThis.PointerEvent) => {
      if (!drag.current.dragging) return;
      const { min: lo, max: hi, step: st, onChange: emit } = latest.current;
      const perPx = (hi - lo) / 160; // full sweep ≈ 160px of drag
      emit?.(clampSnap(drag.current.startVal + (drag.current.startY - e.clientY) * perPx, lo, hi, st));
    };
    const stop = () => {
      drag.current.dragging = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    listeners.current = { move, stop };
  }

  useEffect(() => () => listeners.current?.stop(), []);

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (disabled || e.button !== 0 || !listeners.current) return;
    const { move, stop } = listeners.current;
    drag.current = { startY: e.clientY, startVal: value, dragging: true };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    const big = step * 10;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
    else if (e.key === "PageDown") next = value - big;
    else if (e.key === "PageUp") next = value + big;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    onChange?.(clampSnap(next, min, max, step));
  }

  return (
    <div {...rest} className={cn("grid justify-items-center gap-1.5", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Knob"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled || undefined}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={cn(
          "relative cursor-ns-resize rounded-full border border-border bg-card/80 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none",
          disabled && "pointer-events-none opacity-40",
        )}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        {/* track arc marker */}
        <span
          className="absolute left-1/2 top-1/2 block h-[calc(50%-4px)] w-0.5 origin-bottom -translate-x-1/2 rounded-full bg-accent"
          style={{ transform: `translate(-50%, -100%) rotate(${deg(angle)})`, transformOrigin: "bottom center" }}
        />
        <span className="absolute inset-1.5 rounded-full border border-border/60 bg-background/60" />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

export default DitherKnob;
