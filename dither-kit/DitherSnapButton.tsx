"use client";

import { useEffect, useRef, useState } from "react";
import { rubberband } from "./gesture";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Pull-to-confirm — drag the button past the threshold and let go to fire;
 * short pulls spring home. 1:1 tracking, rubber-band past the line, and the
 * border arms with the accent when the release would count.
 *
 * Port of SnapButton.vue. Reuses `./gesture` (`rubberband`) verbatim. `dx`/`dy`
 * are mirrored to refs so `up()` reads the freshest displacement for the armed
 * check; `dragging` is a ref (gesture guard) plus state (cursor/transition).
 * `still` is resolved after mount to stay SSR-safe (matchMedia is unavailable
 * during prerender). The `threshold * 1.5` soft limit and the spring curve
 * carry across verbatim. */
export interface DitherSnapButtonProps {
  /** Displacement that arms the snap, px. */
  threshold?: number;
  axis?: "x" | "y" | "both";
  color?: PixelColor;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onSnap?: () => void;
}

export function DitherSnapButton({
  threshold = 64,
  axis = "x",
  color = "green",
  disabled = false,
  className,
  children,
  onSnap,
}: DitherSnapButtonProps) {
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const [dy, setDy] = useState(0);
  const dyRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(-1);
  const sxRef = useRef(0);
  const syRef = useRef(0);
  const [still, setStill] = useState(false);

  // pixelPrefersReducedMotion() touches window.matchMedia — resolve after mount.
  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  const dist = Math.hypot(dx, dy);
  const armed = dist >= threshold;

  function clampAxis(x: number, y: number): [number, number] {
    if (axis === "x") return [x, 0];
    if (axis === "y") return [0, y];
    return [x, y];
  }

  function soft(v: number): number {
    const limit = threshold * 1.5;
    return Math.abs(v) > limit ? Math.sign(v) * (limit + rubberband(Math.abs(v) - limit, limit)) : v;
  }

  function down(e: React.PointerEvent<HTMLButtonElement>): void {
    if (disabled) return;
    draggingRef.current = true;
    setDragging(true);
    pointerIdRef.current = e.pointerId;
    sxRef.current = e.clientX;
    syRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
    const [x, y] = clampAxis(e.clientX - sxRef.current, e.clientY - syRef.current);
    const sx = soft(x);
    const sy = soft(y);
    dxRef.current = sx;
    dyRef.current = sy;
    setDx(sx);
    setDy(sy);
  }

  function up(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const d = Math.hypot(dxRef.current, dyRef.current);
    if (d >= threshold) onSnap?.();
    dxRef.current = 0;
    dyRef.current = 0;
    setDx(0);
    setDy(0);
  }

  /** Keyboard path: Enter or Space fires without the pull. */
  function onKeydown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSnap?.();
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex touch-none items-center gap-2 rounded-md border px-3.5 py-2 font-mono text-[12px] select-none",
        CONTROL_BUTTON,
        dragging ? "cursor-grabbing" : "cursor-grab",
        armed ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        "bg-card/60",
        className,
      )}
      style={{
        transform: `translate(${dx}px, ${dy}px)`,
        transition: dragging || still ? "none" : "transform 300ms cubic-bezier(0.2, 1.4, 0.4, 1)",
        borderColor: armed ? cssColor(color) : "var(--border)",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={onKeydown}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-[1px] transition-colors"
        style={{ background: armed ? cssColor(color) : "var(--border)" }}
      />
      {children ?? "Pull to confirm"}
      {armed ? <span className="sr-only">armed, release to confirm</span> : null}
    </button>
  );
}
