"use client";

import { useEffect, useRef, useState } from "react";
import { cssColor } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Hold-to-complete — press and hold while a liquid fill with a dotted crest
 * rises (or slides) toward full; release early and it drains back. Works with
 * pointer or a held Enter/Space; completion fires exactly once per fill.
 *
 * Port of HoldAction.vue. The RAF tick reads/writes `progressRef` as the source
 * of truth and mirrors it to state so the fill re-renders; `holding`/`done` are
 * mirrored to refs the same way so the gesture guards and the "fires once"
 * completion never read stale state. `duration` and `onComplete` are kept in
 * refs so a prop change mid-hold is honored — mirroring Vue's reactive
 * `props.duration` read inside `tick`. The 900ms auto-reset and the asymmetric
 * drain rate (`duration * 0.35`) carry across verbatim. */
export interface DitherHoldActionProps {
  /** Hold time to complete, ms. */
  duration?: number;
  direction?: "vertical" | "horizontal";
  color?: PixelColor;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onComplete?: () => void;
}

export function DitherHoldAction({
  duration = 1200,
  direction = "vertical",
  color = "orange",
  disabled = false,
  className,
  children,
  onComplete,
}: DitherHoldActionProps) {
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const holdingRef = useRef(false);
  const [holding, setHolding] = useState(false);
  const doneRef = useRef(false);
  const [done, setDone] = useState(false);

  const rafRef = useRef(0);
  const dirRef = useRef(0);
  const lastRef = useRef(0);
  const resetTimerRef = useRef<number>(0);
  const durationRef = useRef(duration);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  function tick(now: number): void {
    const dt = Math.min(0.05, (now - lastRef.current) / 1000);
    lastRef.current = now;
    const dir = dirRef.current;
    const rate = dir > 0 ? 1000 / durationRef.current : -1000 / (durationRef.current * 0.35);
    const next = Math.max(0, Math.min(1, progressRef.current + rate * dt));
    progressRef.current = next;
    setProgress(next);
    if (dir > 0 && next >= 1) {
      holdingRef.current = false;
      setHolding(false);
      doneRef.current = true;
      setDone(true);
      onCompleteRef.current?.();
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        doneRef.current = false;
        setDone(false);
        progressRef.current = 0;
        setProgress(0);
      }, 900);
      return;
    }
    if (dir < 0 && next <= 0) return;
    rafRef.current = requestAnimationFrame(tick);
  }

  function start(): void {
    if (disabled || doneRef.current || holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    dirRef.current = 1;
    lastRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function release(): void {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    dirRef.current = -1;
    lastRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    e.preventDefault();
    start();
  }

  function onKeydown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.repeat) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  }

  function onKeyup(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "Enter" || e.key === " ") release();
  }

  // onBeforeUnmount(cancelAnimationFrame + clearTimeout) → single effect.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resetTimerRef.current);
    };
  }, []);

  const vertical = direction === "vertical";

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "relative touch-none overflow-hidden rounded-md border border-border/60 bg-card/60 px-4 py-2.5 font-mono text-[12px] text-muted-foreground transition-colors select-none hover:text-foreground",
        CONTROL_BUTTON,
        (holding || done) && "text-foreground",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={onKeydown}
      onKeyUp={onKeyup}
    >
      <span
        aria-hidden="true"
        className={cn("absolute", vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0")}
        style={vertical ? { height: `${progress * 100}%` } : { width: `${progress * 100}%` }}
      >
        <span className="absolute inset-0 opacity-20" style={{ background: cssColor(color) }} />
        <span
          className={cn(
            "absolute",
            vertical ? "inset-x-0 top-0 h-[3px]" : "inset-y-0 left-full w-[3px] -translate-x-full",
          )}
          style={{
            backgroundImage: `radial-gradient(circle, ${cssColor(color)} 1.2px, transparent 1.2px)`,
            backgroundSize: vertical ? "5px 3px" : "3px 5px",
          }}
        />
      </span>
      <span className="relative">
        {children ?? "Hold to confirm"}
        {done ? " ✓" : ""}
      </span>
      {done ? <span className="sr-only" role="status">completed</span> : null}
    </button>
  );
}
