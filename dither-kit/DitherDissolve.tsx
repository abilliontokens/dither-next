"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import styles from "./DitherDissolve.module.css";

/** Per-cell delay derived from the seed. Each cell gets a deterministic
 * delay offset so the dissolve sweeps through in a seeded order. */
function cellDelay(seed: number, index: number, count: number): number {
  return ((index * 7919 + seed * 31) % count) / count;
}

export type DitherDissolveHandle = {
  /** Re-run the dissolve: reset then re-show on the next frame. */
  trigger: () => void;
  /** Whether the dissolve is currently showing (cells faded out). */
  show: () => boolean;
};

export interface DitherDissolveProps {
  seed?: number;
  cols?: number;
  duration?: number;
  className?: string;
  /** Slot content. Receives the current `show` state (scoped slot `show`). May
   * be a plain node or a render function `(show) => ReactNode`. */
  children?: React.ReactNode | ((show: boolean) => React.ReactNode);
}

/**
 * DitherDissolve - pixel-dissolve transition. A grid of cells fades out in
 * seeded order (per-cell animation-delay from `cellDelay`), revealing the
 * content beneath. Honors `prefers-reduced-motion`. Exposes `trigger()` so
 * consumers can re-dissolve on demand (e.g. on tab change).
 *
 * React port of DitherDissolve.vue.
 */
export const DitherDissolve = forwardRef<
  DitherDissolveHandle,
  DitherDissolveProps
>(function DitherDissolve(
  { seed = 1984, cols = 16, duration = 700, className, children },
  ref,
) {
  const [show, setShow] = useState(false);
  const [reduced, setReduced] = useState(false);

  const cellCount = cols * 12;
  const cells = Array.from({ length: cellCount }, (_, i) => i + 1);

  /** When `show` flips true, each cell fades out with a seeded delay. The delay
   * is derived from a seeded cell order so the dissolve develops organically. */
  function trigger() {
    setShow(false);
    requestAnimationFrame(() => {
      setShow(true);
    });
  }

  useImperativeHandle(
    ref,
    () => ({ trigger, show: () => show }),
    [show],
  );

  // onMounted: read reduced-motion preference and run the first dissolve.
  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
    trigger();
  }, []);

  // watch(() => [props.seed, props.cols, props.duration], trigger)
  useEffect(() => {
    trigger();
  }, [seed, cols, duration]);

  const rendered =
    typeof children === "function" ? children(show) : children;

  return (
    <div className={cn("relative", className)}>
      <div
        className={styles.grid}
        style={
          {
            "--dk-dissolve-cols": cols,
            "--dk-dissolve-duration": `${duration}ms`,
          } as React.CSSProperties
        }
        data-show={show}
        data-reduced={reduced}
      >
        {cells.map((i) => (
          <div
            key={i}
            className={styles.cell}
            style={
              {
                "--dk-dissolve-delay": `${cellDelay(seed, i, cellCount) * duration * 0.6}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className={styles.content}>{rendered}</div>
    </div>
  );
});
