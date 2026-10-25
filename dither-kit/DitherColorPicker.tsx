"use client";

import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from "react";

import { cn, round } from "./lib";

/** HSV color field: a saturation/value plane over the current hue, a hue
 * strip, and a hex readout input — pointer-driven, keyboard on the plane
 * (arrows nudge S/V). Model is the hex string.
 * Port of ColorPicker.vue (`update:modelValue` → `onChange`). Drag listeners
 * read the latest value through a ref (Vue's live props) and are removed on
 * unmount; cursor percentages are rounded for hydration parity. The hex input
 * is a controlled React input, so a keystroke that does not form a hex prefix
 * is refused instead of lingering in the field. */
export interface DitherColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

const HUE_STRIP = {
  background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
};

function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Point = { clientX: number; clientY: number };

export function DitherColorPicker({
  value = "#5227FF",
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherColorPickerProps) {
  const hsv = hexToHsv(value);
  const hueColor = hsvToHex(hsv[0], 1, 1);

  const planeEl = useRef<HTMLDivElement | null>(null);
  const hueEl = useRef<HTMLDivElement | null>(null);
  // Window drag listeners outlive the render that attached them; they read the
  // live hsv/disabled/onChange here, as Vue's handlers read props.
  const latest = useRef({ hsv, disabled, onChange });
  latest.current = { hsv, disabled, onChange };
  const stopTracking = useRef<(() => void) | null>(null);

  useEffect(() => () => stopTracking.current?.(), []);

  function fromPlane(e: Point): void {
    const el = planeEl.current;
    const { hsv: live, disabled: off, onChange: emit } = latest.current;
    if (!el || off) return;
    const rect = el.getBoundingClientRect();
    const s = clamp01((e.clientX - rect.left) / Math.max(1, rect.width));
    const v = 1 - clamp01((e.clientY - rect.top) / Math.max(1, rect.height));
    emit?.(hsvToHex(live[0], s, v));
  }

  function fromHue(e: Point): void {
    const el = hueEl.current;
    const { hsv: live, disabled: off, onChange: emit } = latest.current;
    if (!el || off) return;
    const rect = el.getBoundingClientRect();
    const t = clamp01((e.clientX - rect.left) / Math.max(1, rect.width));
    emit?.(hsvToHex(t * 360, live[1], live[2]));
  }

  function track(onMove: (e: Point) => void): void {
    stopTracking.current?.();
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      stopTracking.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    stopTracking.current = stop;
  }

  function onPlaneDown(e: PointerEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (disabled || e.button !== 0) return;
    fromPlane(e);
    track(fromPlane);
  }

  function onHueDown(e: PointerEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (disabled || e.button !== 0) return;
    fromHue(e);
    track(fromHue);
  }

  function onPlaneKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    const [, s, v] = hsv;
    const d = e.shiftKey ? 0.1 : 0.01;
    let ns = s;
    let nv = v;
    if (e.key === "ArrowLeft") ns = s - d;
    else if (e.key === "ArrowRight") ns = s + d;
    else if (e.key === "ArrowUp") nv = v + d;
    else if (e.key === "ArrowDown") nv = v - d;
    else return;
    e.preventDefault();
    onChange?.(hsvToHex(hsv[0], clamp01(ns), clamp01(nv)));
  }

  function onHueKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const step = 1 + (e.shiftKey ? 15 : 0);
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange?.(hsvToHex(Math.max(0, hsv[0] - step), hsv[1], hsv[2]));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange?.(hsvToHex(Math.min(360, hsv[0] + step), hsv[1], hsv[2]));
    }
  }

  function onHexInput(raw: string): void {
    const cleaned = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-f]{0,6}$/i.test(cleaned)) {
      onChange?.(cleaned);
    }
  }

  return (
    <div {...rest} className={cn("grid w-60 gap-2", disabled && "opacity-40", className)}>
      <div
        ref={planeEl}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={value}
        aria-disabled={disabled || undefined}
        className="relative h-36 w-full cursor-crosshair rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}`,
        }}
        onPointerDown={onPlaneDown}
        onKeyDown={onPlaneKeyDown}
      >
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${round(hsv[1] * 100)}%`, top: `${round(100 - hsv[2] * 100)}%`, background: value }}
        />
      </div>

      <div
        ref={hueEl}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv[0])}
        aria-disabled={disabled || undefined}
        className="relative h-4 w-full cursor-ew-resize rounded-full border border-border outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        style={HUE_STRIP}
        onPointerDown={onHueDown}
        onKeyDown={onHueKeyDown}
      >
        <span
          className="pointer-events-none absolute left-0 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ marginLeft: `${round((hsv[0] / 360) * 100)}%`, background: hueColor }}
        />
      </div>

      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
        Hex
        <input
          value={value}
          disabled={disabled}
          spellCheck={false}
          className="min-h-8 flex-1 rounded border border-border/70 bg-transparent px-2 font-mono text-[12.5px] uppercase text-foreground outline-none focus-visible:border-accent/70 motion-reduce:transition-none"
          onChange={(e) => onHexInput(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}

export default DitherColorPicker;
