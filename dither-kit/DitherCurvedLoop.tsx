"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
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

  const measureRef = useRef<SVGTextElement | null>(null);
  const textPathRef = useRef<SVGTextPathElement | null>(null);

  useEffect(() => {
    const measureEl = measureRef.current;
    const textPathEl = textPathRef.current;
    if (!measureEl || !textPathEl) return;

    const copyLen = measureEl.getComputedTextLength?.() || 0;
    if (!copyLen || pixelPrefersReducedMotion()) return;

    let raf = 0;
    let offset = 0;
    let lastT = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
      lastT = now;
      offset -= speed * dt;
      while (offset <= -copyLen) offset += copyLen;
      textPathEl.setAttribute("startOffset", String(offset));
    };

    raf = requestAnimationFrame(frame);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text, speed]);

  return (
    <svg
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
