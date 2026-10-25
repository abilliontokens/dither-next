"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { useInviewLoop } from "./use-inview-loop";
import styles from "./DitherCurvedLoop.module.css";

/**
 * DitherCurvedLoop — text scrolling along a curved SVG path. A hidden
 * measurement `<text>` (off-canvas) is read once on mount for its
 * `getComputedTextLength()`; the visible `<textPath>`'s `startOffset` is then
 * advanced each frame by `speed` (px/s), wrapping modulo the measured length
 * for a seamless loop. The RAF loop is skipped under
 * `prefers-reduced-motion: reduce`, leaving the text static. `useId` keeps the
 * path id SSR-stable and unique per instance.
 */
export interface DitherCurvedLoopProps {
  text?: string;
  speed?: number;
  className?: string;
}

export function DitherCurvedLoop({
  text = "DITHER UI · CANVAS + BAYER · ",
  speed = 60,
  className,
}: DitherCurvedLoopProps) {
  const rawId = useId();
  const uid = "dither-curve-" + rawId.replace(/:/g, "");
  const d = "M -100 58 Q 25 18 150 58 T 400 58 T 650 58 T 900 58";
  const content = text.repeat(10);

  const hostRef = useRef<SVGSVGElement | null>(null);
  const measureRef = useRef<SVGTextElement | null>(null);
  const textPathRef = useRef<SVGTextPathElement | null>(null);
  const rafRef = useRef(0);
  const offsetRef = useRef(0);
  const copyLenRef = useRef(0);
  const lastTRef = useRef(0);

  function frame(now: number) {
    rafRef.current = requestAnimationFrame(frame);
    const el = textPathRef.current;
    const copyLen = copyLenRef.current;
    if (!el || !copyLen) return;
    const dt = lastTRef.current ? Math.min(0.05, (now - lastTRef.current) / 1000) : 0;
    lastTRef.current = now;
    offsetRef.current -= speed * dt;
    while (offsetRef.current <= -copyLen) offsetRef.current += copyLen;
    el.setAttribute("startOffset", String(offsetRef.current));
  }

  function start() {
    if (rafRef.current || pixelPrefersReducedMotion()) return;
    rafRef.current = requestAnimationFrame(frame);
  }
  function stop() {
    if (!rafRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }

  useEffect(() => {
    copyLenRef.current = measureRef.current?.getComputedTextLength?.() || 0;
    offsetRef.current = 0;
    lastTRef.current = 0;
    // Props changed: hand a running loop the fresh frame closure.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(frame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);
  useInviewLoop(hostRef, start, stop);

  return (
    <svg
      ref={hostRef}
      viewBox="0 0 600 100"
      className={cn("w-full", className)}
      aria-label={text}
    >
      <defs>
        <path id={uid} d={d} fill="none" />
      </defs>
      <text
        ref={measureRef}
        className={styles.ditherCurveText}
        x="-9999"
        y="-9999"
      >
        {text}
      </text>
      <text className={styles.ditherCurveText} aria-hidden="true">
        <textPath ref={textPathRef} href={`#${uid}`} startOffset="0">
          {content}
        </textPath>
      </text>
    </svg>
  );
}
