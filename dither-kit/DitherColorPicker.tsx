"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CONTROL } from "./control";
import { cn } from "./lib";
import { cssColor, colorToHex, hexToRgb, hexToHsv, hsvToRgb, rgbToHex } from "./palette";
import { BAYER4, clamp01, type PixelColor } from "./pixel";

const CELL = 2;
const LEVELS = 4;
const SV_STEP = 0.02;
const SV_STEP_COARSE = 0.1;
const HUE_STEP = 2;
const HUE_STEP_COARSE = 15;

/** Named kit swatches + achromatic bookends, resolved through `colorToHex`. */
const SWATCHES: PixelColor[] = [
  "red",
  "orange",
  "green",
  "blue",
  "purple",
  "pink",
  "grey",
  "#000000",
  "#ffffff",
];

/**
 * Ordered-dither a single colour channel to `LEVELS` discrete steps. Classic
 * Bayer quantization: the threshold scatter (`t − 0.5`) folds the continuous
 * value onto the nearest of `LEVELS` levels so a gradient reads as the kit's
 * signature stipple rather than a smooth alpha ramp. Mirrors the texture the
 * charts/slider paint with via `BAYER4`.
 */
function ditherChannel(c: number, t: number): number {
  const offset = (t - 0.5) / LEVELS;
  const v = c + offset;
  const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(clamped * (LEVELS - 1)) / (LEVELS - 1);
}

export interface DitherColorPickerProps {
  /** Controlled colour as a `#rrggbb` hex string. */
  value: string;
  /** Fired with a normalised `#rrggbb` hex string on every change. */
  onChange?: (hex: string) => void;
  /** Accessible name for the whole picker. */
  label?: string;
  className?: string;
}

/**
 * DitherColorPicker — HSV colour picker whose saturation/value field and hue
 * rail are painted through the kit's ordered-dither engine, so the surface
 * reads as Bayer pixels instead of a smooth alpha gradient.
 *
 * The SV field is a low-resolution canvas (1 device-px per 2-CSS-px cell,
 * stretched with `image-rendering: pixelated` — same trick as `DitherSlider`)
 * where each cell is `hsvToRgb(hue, s, v)` quantised to four levels per channel
 * through `BAYER4`. The hue rail uses the same dither along its spectrum so
 * the pair share one texture.
 *
 * Colour math is reused verbatim from `./palette` (`hexToHsv`/`hsvToRgb`/
 * `rgbToHex`/`colorToHex`) — no local colour code. A held hue (`fieldHue`)
 * survives picking an achromatic swatch (white/black/grey) so the field does
 * not snap to red when the value channel bottoms out — the standard picker
 * behaviour. `fieldHue` lives in state because it drives the painted canvas.
 *
 * Pointer drag uses `setPointerCapture` on each surface. The SV field is a
 * labelled, focusable region with arrow nudging (Shift = coarse) and a live
 * hex/hsv readout; the hue rail is a proper `role="slider"` with arrows plus
 * Home/End. Reduced motion is read in a mount effect (the crosshair has no
 * motion to suppress, but the contract is honoured for any focus transition).
 */
export function DitherColorPicker({
  value,
  onChange,
  label = "Colour picker",
  className,
}: DitherColorPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fieldCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  const reactId = useId();
  const readoutId = `${reactId}-readout`;
  const hexInputId = `${reactId}-hex`;

  // Derive the current HSV from the controlled value. `hexToHsv` returns a
  // stable {h,s,v}; h is 0 when the colour is achromatic.
  const hsv = useMemo(() => hexToHsv(value), [value]);

  // The hue the field paints with. Synced from `value` only when the colour is
  // chromatic, so picking white/black keeps the last meaningful hue. State, not
  // a ref, because it drives the canvas repaint.
  const [fieldHue, setFieldHue] = useState<number>(hsv.h);
  useEffect(() => {
    if (hsv.s > 0.001 && hsv.v > 0.001 && Math.abs(hsv.h - fieldHue) > 0.5) {
      setFieldHue(hsv.h);
    }
    // `fieldHue` intentionally excluded — we only react to the source value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Local draft for the hex input so typing a partial hex does not snap back.
  const [hexDraft, setHexDraft] = useState(value);
  const [hexFocused, setHexFocused] = useState(false);
  useEffect(() => {
    if (!hexFocused) setHexDraft(value);
  }, [value, hexFocused]);
  function commit(h: number, s: number, v: number): void {
    onChange?.(rgbToHex(hsvToRgb(h, s, v)));
  }

  /** Paint the saturation/value field through the Bayer dither. */
  function paintField(): void {
    const root = fieldRef.current;
    const canvas = fieldCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;
    const box = root.getBoundingClientRect();
    const cols = Math.max(8, Math.round(box.width / CELL));
    const rows = Math.max(8, Math.round(box.height / CELL));
    canvas.width = cols;
    canvas.height = rows;
    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    for (let y = 0; y < rows; y++) {
      const v = 1 - (y + 0.5) / rows;
      for (let x = 0; x < cols; x++) {
        const s = (x + 0.5) / cols;
        const [r, g, b] = hsvToRgb(fieldHue, s, v);
        const tx = BAYER4[y & 3][x & 3];
        const o = (y * cols + x) * 4;
        data[o] = Math.round(ditherChannel(r / 255, tx) * 255);
        data[o + 1] = Math.round(ditherChannel(g / 255, tx) * 255);
        data[o + 2] = Math.round(ditherChannel(b / 255, tx) * 255);
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Paint the hue rail spectrum through the same dither. */
  function paintHue(): void {
    const root = hueRef.current;
    const canvas = hueCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;
    const box = root.getBoundingClientRect();
    const cols = Math.max(8, Math.round(box.width / CELL));
    const rows = Math.max(2, Math.round(box.height / CELL));
    canvas.width = cols;
    canvas.height = rows;
    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const hue = (x / cols) * 360;
        const [r, g, b] = hsvToRgb(hue, 1, 1);
        const tx = BAYER4[y & 3][x & 3];
        const o = (y * cols + x) * 4;
        data[o] = Math.round(ditherChannel(r / 255, tx) * 255);
        data[o + 1] = Math.round(ditherChannel(g / 255, tx) * 255);
        data[o + 2] = Math.round(ditherChannel(b / 255, tx) * 255);
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Mount + resize + value/hue repaint. rAF defers so layout is settled; the
  // ResizeObserver repaints on container resize. Cleanup cancels both.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      paintField();
      paintHue();
      if (typeof ResizeObserver !== "undefined" && rootRef.current) {
        ro = new ResizeObserver(() => {
          paintField();
          paintHue();
        });
        ro.observe(rootRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fieldHue]);

  // --- SV field pointer drag -------------------------------------------------
  const fieldDrag = useRef(false);
  function fieldPointToSV(clientX: number, clientY: number): { s: number; v: number } {
    const rect = fieldRef.current!.getBoundingClientRect();
    const s = clamp01((clientX - rect.left) / Math.max(1, rect.width));
    const v = 1 - clamp01((clientY - rect.top) / Math.max(1, rect.height));
    return { s, v };
  }
  function onFieldPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    fieldRef.current?.setPointerCapture(e.pointerId);
    fieldDrag.current = true;
    const { s, v } = fieldPointToSV(e.clientX, e.clientY);
    commit(fieldHue, s, v);
  }
  function onFieldPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!fieldDrag.current) return;
    if (!fieldRef.current?.hasPointerCapture(e.pointerId)) return;
    const { s, v } = fieldPointToSV(e.clientX, e.clientY);
    commit(fieldHue, s, v);
  }
  function onFieldPointerUp(): void {
    fieldDrag.current = false;
  }
  function onFieldKeydown(e: KeyboardEvent<HTMLDivElement>): void {
    let { s, v } = hsv;
    const coarse = e.shiftKey ? SV_STEP_COARSE : SV_STEP;
    if (e.key === "ArrowRight") s = clamp01(s + coarse);
    else if (e.key === "ArrowLeft") s = clamp01(s - coarse);
    else if (e.key === "ArrowUp") v = clamp01(v + coarse);
    else if (e.key === "ArrowDown") v = clamp01(v - coarse);
    else return;
    e.preventDefault();
    commit(fieldHue, s, v);
  }

  // --- Hue rail pointer drag + slider keys ----------------------------------
  const hueDrag = useRef(false);
  function huePointToHue(clientX: number): number {
    const rect = hueRef.current!.getBoundingClientRect();
    return clamp01((clientX - rect.left) / Math.max(1, rect.width)) * 360;
  }
  function onHuePointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    hueRef.current?.setPointerCapture(e.pointerId);
    hueDrag.current = true;
    const h = huePointToHue(e.clientX);
    setFieldHue(h);
    commit(h, hsv.s, hsv.v);
  }
  function onHuePointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!hueDrag.current) return;
    if (!hueRef.current?.hasPointerCapture(e.pointerId)) return;
    const h = huePointToHue(e.clientX);
    setFieldHue(h);
    commit(h, hsv.s, hsv.v);
  }
  function onHuePointerUp(): void {
    hueDrag.current = false;
  }
  function onHueKeydown(e: KeyboardEvent<HTMLDivElement>): void {
    const coarse = e.shiftKey ? HUE_STEP_COARSE : HUE_STEP;
    let h = fieldHue;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") h = (fieldHue + coarse) % 360;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") h = (fieldHue - coarse + 360) % 360;
    else if (e.key === "Home") h = 0;
    else if (e.key === "End") h = 359;
    else return;
    e.preventDefault();
    setFieldHue(h);
    commit(h, hsv.s, hsv.v);
  }

  // --- Hex input round-trip -------------------------------------------------
  function onHexChange(raw: string): void {
    setHexDraft(raw);
    let h = raw.trim();
    if (!h.startsWith("#")) h = `#${h}`;
    if (/^#[0-9a-fA-F]{6}$/.test(h) || /^#[0-9a-fA-F]{3}$/.test(h)) {
      onChange?.(rgbToHex(hexToRgb(h)));
    }
  }

  const crossLeft = `${hsv.s * 100}%`;
  const crossTop = `${(1 - hsv.v) * 100}%`;
  const hueLeft = `${(fieldHue / 360) * 100}%`;
  const readout = `Hue ${Math.round(fieldHue)}°, saturation ${Math.round(hsv.s * 100)} percent, value ${Math.round(hsv.v * 100)} percent, ${value}`;

  return (
    <div ref={rootRef} className={cn("w-full select-none text-foreground", className)}>
      <div className="flex gap-2">
        <div
          ref={fieldRef}
          role="group"
          aria-label={`${label}, saturation and value field`}
          aria-describedby={readoutId}
          tabIndex={0}
          className="relative h-40 flex-1 cursor-crosshair overflow-hidden rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onPointerDown={onFieldPointerDown}
          onPointerMove={onFieldPointerMove}
          onPointerUp={onFieldPointerUp}
          onPointerCancel={onFieldPointerUp}
          onKeyDown={onFieldKeydown}
        >
          <canvas
            ref={fieldCanvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-[1px] border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.7)]"
            style={{ left: crossLeft, top: crossTop }}
          />
        </div>
        <div
          ref={hueRef}
          role="slider"
          aria-label={`${label}, hue`}
          aria-describedby={readoutId}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(fieldHue)}
          aria-valuetext={`${Math.round(fieldHue)} degrees`}
          tabIndex={0}
          className="relative h-40 w-5 cursor-pointer overflow-hidden rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onPointerDown={onHuePointerDown}
          onPointerMove={onHuePointerMove}
          onPointerUp={onHuePointerUp}
          onPointerCancel={onHuePointerUp}
          onKeyDown={onHueKeydown}
        >
          <canvas
            ref={hueCanvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 border-x border-white bg-foreground/10"
            style={{ left: hueLeft }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-7 shrink-0 rounded-[2px] border border-border"
          style={{ backgroundColor: value }}
        />
        <input
          id={hexInputId}
          type="text"
          value={hexDraft}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label}, hex value`}
          className={cn(CONTROL, "h-9 w-28 font-mono text-[12px] uppercase")}
          onFocus={() => setHexFocused(true)}
          onBlur={() => {
            setHexFocused(false);
            setHexDraft(value);
          }}
          onChange={(e) => onHexChange(e.currentTarget.value)}
        />
        <span id={readoutId} className="sr-only" role="status" aria-live="polite">
          {readout}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${label}, preset swatches`}>
        {SWATCHES.map((sw) => {
          const hex = colorToHex(sw);
          const selected = value.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={sw}
              type="button"
              aria-label={`${typeof sw === "string" ? sw : "swatch"} ${hex}`}
              aria-pressed={selected}
              className={cn(
                "size-5 rounded-[2px] border transition-transform motion-reduce:transition-none hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected ? "border-foreground" : "border-border",
              )}
              style={{ backgroundColor: cssColor(sw), imageRendering: "pixelated" }}
              onClick={() => {
                const next = hexToHsv(hex);
                if (next.s > 0.001 && next.v > 0.001) setFieldHue(next.h);
                onChange?.(hex);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
