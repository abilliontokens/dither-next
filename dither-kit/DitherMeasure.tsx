"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";

/**
 * DitherMeasure — reports its own box size: renders the children in a plain
 * block and calls `onResize` with `{ width, height }` whenever the box changes
 * (first observation included). ResizeObserver-only — without it (jsdom,
 * ancient engines) it simply renders and stays silent rather than guessing.
 * `className` and other attrs fall through to the block untouched.
 * Port of Measure.vue (`emit("resize")` → `onResize`).
 */
export interface DitherMeasureSize {
  width: number;
  height: number;
}

export interface DitherMeasureProps extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
  onResize?: (size: DitherMeasureSize) => void;
}

export function DitherMeasure({ onResize, children, ...rest }: DitherMeasureProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Latest callback in a ref so the observer is created once per mount.
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const el = rootRef.current;
    if (typeof ResizeObserver === "undefined" || !el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        onResizeRef.current?.({
          width: Math.round(e.contentRect.width),
          height: Math.round(e.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div {...rest} ref={rootRef}>
      {children}
    </div>
  );
}

export default DitherMeasure;
