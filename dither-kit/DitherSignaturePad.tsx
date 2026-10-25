"use client";

import { useRef, type HTMLAttributes, type PointerEvent } from "react";

import { DitherButton } from "./DitherButton";
import { cn } from "./lib";

/** Signature pad: pointer drawing on a canvas, `change` fires the dataURL
 * after every stroke (and on clear). Canvas is sized in markup; the drawing
 * context is checked once at mount — a context-less environment (jsdom) keeps
 * the control honest by refusing strokes instead of throwing.
 * Port of SignaturePad.vue. Upstream emits `update:modelValue` and `change`
 * together with the same dataURL; React collapses them into one `onChange`.
 * Canvas house pattern: the canvas, the drawing flag and the context probe are
 * refs (nothing re-renders mid-stroke). Pointer coordinates are mapped from
 * the CSS box into the canvas's markup resolution, so a `w-full` canvas
 * stretched past `width` still draws under the pointer (upstream drew at the
 * unscaled CSS offset). `size="sm"` on the Clear button is dropped —
 * DitherButton has no size prop (it was an inert fallthrough attr in Vue). */
export interface DitherSignaturePadProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  width?: number;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

export function DitherSignaturePad({
  width = 420,
  height = 160,
  placeholder = "Sign here",
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherSignaturePadProps) {
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasContext = useRef(false);

  function context(): CanvasRenderingContext2D | null {
    const el = canvasEl.current;
    if (!el) return null;
    if (!hasContext.current) {
      hasContext.current = el.getContext("2d") !== null;
      if (!hasContext.current) return null;
    }
    return el.getContext("2d");
  }

  function localPoint(e: PointerEvent<HTMLCanvasElement>): [number, number] {
    const el = canvasEl.current;
    if (!el) return [0, 0];
    const rect = el.getBoundingClientRect();
    const sx = rect.width > 0 ? el.width / rect.width : 1;
    const sy = rect.height > 0 ? el.height / rect.height : 1;
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
  }

  function strokeEnd(): void {
    if (!drawing.current) return;
    drawing.current = false;
    const el = canvasEl.current;
    onChange?.(el ? el.toDataURL("image/png") : "");
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    if (disabled || e.button !== 0) return;
    const ctx = context();
    if (!ctx) return;
    drawing.current = true;
    const [x, y] = localPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y); // a dot for a single-tap stroke
    ctx.strokeStyle = "currentColor";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    const [x, y] = localPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function clear(): void {
    const el = canvasEl.current;
    const ctx = context();
    if (el && ctx) ctx.clearRect(0, 0, el.width, el.height);
    onChange?.("");
  }

  return (
    <div {...rest} className={cn("grid gap-2", className)}>
      <canvas
        ref={canvasEl}
        width={width}
        height={height}
        aria-label={placeholder}
        role="img"
        className={cn(
          "w-full cursor-crosshair touch-none rounded-md border border-border bg-background/60 outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          disabled && "pointer-events-none opacity-40",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={strokeEnd}
        onPointerLeave={strokeEnd}
        onPointerCancel={strokeEnd}
      />
      <DitherButton variant="solid" className="justify-self-start" disabled={disabled} onClick={clear}>
        Clear
      </DitherButton>
    </div>
  );
}

export default DitherSignaturePad;
