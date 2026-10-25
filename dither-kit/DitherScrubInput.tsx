"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

import DitherIcon from "./DitherIcon";
import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Drag-to-scrub numeric field (the Figma-style gesture): the grip is a real
 * `role="slider"` — arrow keys, PageUp/Down and Home/End work without a
 * pointer, and the read-only input stays selectable for copying. Values snap
 * to `step`; float noise is trimmed by the step's own precision.
 * Port of ScrubInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `v-bind="$attrs"` → `...rest` onto the inner DitherInput, `className` on the
 * root as upstream's `props.class`; window drag listeners are stable and read the
 * latest props through a ref; `onBeforeUnmount` → effect cleanup). */
export interface DitherScrubInputProps extends Omit<DitherInputProps, "value" | "onChange" | "readOnly"> {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

function decimalsOf(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

function clampSnap(next: number, min: number, max: number, step: number): number {
  const snapped = Math.round(next / step) * step;
  const rounded = Number(snapped.toFixed(decimalsOf(step)));
  return Math.min(max, Math.max(min, rounded));
}

export function DitherScrubInput({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  ...rest
}: DitherScrubInputProps) {
  const decimals = decimalsOf(step);
  const display = Number.isInteger(value) ? String(value) : value.toFixed(decimals);

  const latest = useRef({ min, max, step, onChange });
  latest.current = { min, max, step, onChange };
  const drag = useRef({ startX: 0, startVal: 0, dragging: false });

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!drag.current.dragging) return;
    const { min: lo, max: hi, step: st, onChange: emit } = latest.current;
    emit?.(clampSnap(drag.current.startVal + (e.clientX - drag.current.startX) * st, lo, hi, st));
  }, []);
  const onPointerUp = useCallback(() => {
    drag.current.dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }, [onPointerMove]);
  useEffect(() => () => onPointerUp(), [onPointerUp]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
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
    <div className={cn("flex items-stretch gap-1", className)}>
      <DitherInput
        {...rest}
        readOnly
        value={display}
        disabled={disabled}
        className="flex-1 cursor-ew-resize text-right tabular-nums"
      />
      <button
        type="button"
        role="slider"
        aria-label="Scrub value"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        aria-disabled={disabled}
        disabled={disabled}
        className="grid w-7 shrink-0 cursor-ew-resize place-items-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        onPointerDown={(e) => {
          e.preventDefault();
          if (disabled || e.button !== 0) return;
          drag.current = { startX: e.clientX, startVal: value, dragging: true };
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", onPointerUp);
          window.addEventListener("pointercancel", onPointerUp);
        }}
        onKeyDown={onKeyDown}
      >
        <DitherIcon name="GripVertical" size={14} />
      </button>
    </div>
  );
}

export default DitherScrubInput;
