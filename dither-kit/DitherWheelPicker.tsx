"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { project, velocityFrom, type VelocitySample } from "./gesture";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import type { PixelColor } from "./pixel";
import { cn } from "./lib";

export type WheelOption = string | { value: string; label: string };

const ITEM = 28;

/**
 * DitherWheelPicker — iOS-style picker wheel. Verbatim port of WheelPicker.vue.
 *
 * A 3D drum on native momentum scroll that snaps to the nearest notch. Wheel,
 * drag (mouse via gesture projection, touch native) and spinbutton keys all
 * steer it; wheels compose side by side for date and time pickers. Reduced
 * motion flattens the drum and stills the glides.
 *
 * Gesture contract: mouse drags move `scrollTop` 1:1 (no native momentum for
 * mice), and on release `project(velocityFrom(samples))` decides where the
 * flick would land — the same Apple "Designing Fluid Interfaces" math the
 * drawer uses, from `./gesture`. Touch relies on CSS scroll-snap + native
 * momentum, so pointer handlers bail unless `pointerType === "mouse"`.
 *
 * `modelValue` → `value`/`onChange`. `still` is the SSR-safe reduced-motion
 * read (state + effect, like DitherDock): `false` on the server so the 3D
 * transform renders during prerender, corrected after mount.
 */
export interface DitherWheelPickerProps {
  options: WheelOption[];
  value?: string;
  /** Visible rows (odd). */
  rows?: number;
  /** Accessible name for the wheel. */
  label?: string;
  color?: PixelColor;
  className?: string;
  onChange?: (value: string) => void;
}

export function DitherWheelPicker({
  options,
  value,
  rows = 5,
  label = "Wheel picker",
  color = "blue",
  className,
  onChange,
}: DitherWheelPickerProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [st, setSt] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  const opts = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
    [options],
  );
  const rowCount = Math.max(3, rows | 1);
  const clampIndex = (i: number) => Math.max(0, Math.min(opts.length - 1, i));
  const index = clampIndex(Math.round(st / ITEM));

  function styleOf(i: number): React.CSSProperties {
    const d = (i * ITEM - st) / ITEM;
    const opacity = Math.max(0.15, 1 - Math.abs(d) * 0.22);
    if (still) return { opacity: String(opacity) };
    const a = Math.max(-64, Math.min(64, d * -16));
    return { opacity: String(opacity), transform: `perspective(560px) rotateX(${a}deg)` };
  }

  // Mouse-drag gesture state (refs — no re-render needed while dragging).
  const settleRef = useRef(0);
  const samplesRef = useRef<VelocitySample[]>([]);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  function commit(): void {
    const el = scroller.current;
    if (!el || draggingRef.current) return;
    const i = clampIndex(Math.round(el.scrollTop / ITEM));
    if (Math.abs(el.scrollTop - i * ITEM) > 1) {
      el.scrollTo({ top: i * ITEM, behavior: still ? "auto" : "smooth" });
    }
    el.style.scrollSnapType = "";
    const v = opts[i]?.value;
    if (v !== undefined && v !== value) onChange?.(v);
  }

  function onScroll(): void {
    const el = scroller.current;
    if (!el) return;
    setSt(el.scrollTop);
    clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(commit, 120);
  }

  function go(i: number): void {
    const el = scroller.current;
    if (!el) return;
    const j = clampIndex(i);
    el.scrollTo({ top: j * ITEM, behavior: still ? "auto" : "smooth" });
    const v = opts[j]?.value;
    if (v !== undefined && v !== value) onChange?.(v);
  }

  function onKeydown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const stepMap: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -5,
      PageDown: 5,
    };
    const step = stepMap[e.key];
    if (step !== undefined) {
      e.preventDefault();
      go(index + step);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(opts.length - 1);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current;
    if (!el) return;
    e.preventDefault();
    el.focus();
    el.setPointerCapture(e.pointerId);
    el.style.scrollSnapType = "none";
    draggingRef.current = true;
    movedRef.current = false;
    samplesRef.current = [{ t: e.timeStamp, p: e.clientY }];
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current) return;
    const el = scroller.current;
    const samples = samplesRef.current;
    const prev = samples[samples.length - 1];
    if (!el || !prev) return;
    if (Math.abs(e.clientY - samples[0].p) > 4) movedRef.current = true;
    el.scrollTop -= e.clientY - prev.p;
    samples.push({ t: e.timeStamp, p: e.clientY });
    if (samples.length > 6) samples.shift();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current || e.pointerType !== "mouse") return;
    draggingRef.current = false;
    const el = scroller.current;
    if (!el) return;
    const dest = el.scrollTop - project(still ? 0 : velocityFrom(samplesRef.current));
    go(Math.round(dest / ITEM));
    clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(commit, 120);
  }

  // `watch(() => props.modelValue)` (non-immediate): scroll to the value's
  // notch when it changes externally. First run skipped (mount owns the
  // initial position below).
  const valueFirstRef = useRef(true);
  useEffect(() => {
    if (valueFirstRef.current) {
      valueFirstRef.current = false;
      return;
    }
    const i = opts.findIndex((o) => o.value === value);
    const el = scroller.current;
    if (i >= 0 && i !== index && !draggingRef.current) {
      el?.scrollTo({ top: i * ITEM, behavior: still ? "auto" : "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // `onMounted`: set the initial scroll position to the selected value.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = Math.max(0, opts.findIndex((o) => o.value === value)) * ITEM;
    setSt(el.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any pending settle timer on unmount.
  useEffect(() => {
    return () => clearTimeout(settleRef.current);
  }, []);

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-7 -translate-y-1/2 rounded-md border-y border-border/70 bg-foreground/[0.04]"
      />
      <div
        ref={scroller}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={opts.length - 1}
        aria-valuenow={index}
        aria-valuetext={opts[index]?.label}
        className="snap-y snap-mandatory select-none overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          height: `${rowCount * ITEM}px`,
          paddingBlock: `${((rowCount - 1) / 2) * ITEM}px`,
        }}
        onScroll={onScroll}
        onKeyDown={onKeydown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {opts.map((o, i) => (
          <div
            key={o.value}
            aria-hidden="true"
            className={cn(
              "flex h-7 snap-center items-center justify-center px-3 text-[13px] tabular-nums",
              i === index ? "font-medium" : "text-muted-foreground/80",
            )}
            style={{
              ...styleOf(i),
              ...(i === index ? { color: cssColor(color) } : {}),
            }}
            onClick={() => {
              if (!movedRef.current) go(i);
            }}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}
