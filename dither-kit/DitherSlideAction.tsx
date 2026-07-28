"use client";

import { useEffect, useRef, useState } from "react";
import { project, rubberband, velocityFrom, type VelocitySample } from "./gesture";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Slide-to-confirm — drag the thumb to the end of the track (or flick it;
 * momentum projection counts) to fire, release early and it springs back.
 * Enter or Space confirms without the slide.
 *
 * Port of SlideAction.vue. Reuses `./gesture` (`project`/`rubberband`/
 * `velocityFrom`) verbatim — no easing or projection math is reimplemented.
 * `x` and `travel` are mirrored to refs because `finish()` reads `travel`
 * immediately after `measure()` (a setState would be async) and `up()` reads
 * the latest `x` for the flick/position decision; `dragging`/`done` are refs
 * for the gesture guards and "fires once" completion, plus state for the
 * cursor/transition. `still` is resolved after mount to stay SSR-safe
 * (matchMedia is unavailable during prerender). */
export interface DitherSlideActionProps {
  label?: string;
  color?: PixelColor;
  disabled?: boolean;
  className?: string;
  onConfirm?: () => void;
}

export function DitherSlideAction({
  label = "Slide to confirm",
  color = "green",
  disabled = false,
  className,
  onConfirm,
}: DitherSlideActionProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLButtonElement | null>(null);
  const [x, setX] = useState(0);
  const xRef = useRef(0);
  const [travel, setTravel] = useState(1);
  const travelRef = useRef(1);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const pidRef = useRef(-1);
  const sxRef = useRef(0);
  const samplesRef = useRef<VelocitySample[]>([]);
  const resetTimerRef = useRef<number>(0);
  const [still, setStill] = useState(false);

  // pixelPrefersReducedMotion() touches window.matchMedia — resolve after mount.
  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  function measure(): void {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (track && thumb) {
      const t = Math.max(1, track.clientWidth - thumb.offsetWidth - 8);
      travelRef.current = t;
      setTravel(t);
    }
  }

  function finish(): void {
    measure();
    xRef.current = travelRef.current;
    setX(travelRef.current);
    doneRef.current = true;
    setDone(true);
    onConfirm?.();
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      doneRef.current = false;
      setDone(false);
      xRef.current = 0;
      setX(0);
    }, 900);
  }

  function down(e: React.PointerEvent<HTMLButtonElement>): void {
    if (disabled || doneRef.current) return;
    measure();
    draggingRef.current = true;
    setDragging(true);
    pidRef.current = e.pointerId;
    sxRef.current = e.clientX - xRef.current;
    samplesRef.current = [{ t: e.timeStamp, p: e.clientX }];
    thumbRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || e.pointerId !== pidRef.current) return;
    const raw = e.clientX - sxRef.current;
    const next = raw < 0 ? -rubberband(-raw, 48) : Math.min(raw, travelRef.current);
    xRef.current = next;
    setX(next);
    samplesRef.current.push({ t: e.timeStamp, p: e.clientX });
    if (samplesRef.current.length > 6) samplesRef.current.shift();
  }

  function up(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!draggingRef.current || e.pointerId !== pidRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (
      xRef.current >= travelRef.current - 2 ||
      xRef.current + project(velocityFrom(samplesRef.current)) >= travelRef.current
    ) {
      finish();
    } else {
      xRef.current = 0;
      setX(0);
    }
  }

  /** Keyboard path: Enter or Space confirms without the slide. */
  function onKeydown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (disabled || doneRef.current) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      finish();
    }
  }

  // onBeforeUnmount(clearTimeout) → single effect.
  useEffect(() => {
    return () => {
      clearTimeout(resetTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative flex h-10 w-64 touch-none items-center rounded-full border border-border/60 bg-card/60 px-1 select-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 text-center font-mono text-[12px] text-muted-foreground"
        style={{ opacity: x ? Math.max(0, 1 - x / (travel * 0.6)) : 1 }}
      >
        {label}
      </span>
      <button
        ref={thumbRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-[14px] text-background",
          CONTROL_BUTTON,
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{
          background: cssColor(color),
          transform: `translateX(${x}px)`,
          transition: dragging || still ? "none" : "transform 300ms cubic-bezier(0.2, 1.4, 0.4, 1)",
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={onKeydown}
      >
        {done ? "✓" : "→"}
      </button>
      {done ? <span className="sr-only" role="status">confirmed</span> : null}
    </div>
  );
}
