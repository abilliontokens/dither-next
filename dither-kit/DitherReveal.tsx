"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { directedTime, isDirected, onSeek } from "./clock";
import { resolveEasing, type EasingInput } from "./dither-paint";
import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { useInviewLoop } from "./use-inview-loop";
import { wipeStyle, type WipeDirection } from "./wipe";

export type { WipeDirection, WipeOptions, WipeStyle } from "./wipe";
export { BAYER8, bayerMatrix, wipeStyle } from "./wipe";

export interface DitherRevealProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Manual progress 0-1 (a timeline's); unset, the reveal plays `duration` seconds on the kit clock. */
  progress?: number;
  duration?: number;
  delay?: number;
  /** Where the front travels; "none" dissolves in place. */
  direction?: WipeDirection;
  /** Cell size in CSS px. */
  cell?: number;
  /** Directional wipes: the dithered band's width in cells. */
  band?: number;
  /** A seeded 4x4 matrix instead of the 8x8 Bayer. */
  seed?: number;
  /** Hide instead of reveal as progress grows. */
  reverse?: boolean;
  easing?: EasingInput;
  /** Change to play again. */
  restartKey?: unknown;
  className?: string;
  children?: ReactNode;
}

type Box<T> = { readonly current: T };
type RevealClockProps = { progress?: number; duration: number; delay: number };
type RevealClock = {
  play: () => void;
  stop: () => void;
  seekTo: (ms: number) => void;
  restart: () => void;
};

/** The timed reveal — the Vue clock verbatim, reading props through `props.current`. */
function createRevealClock(props: Box<RevealClockProps>, setPlayed: (p: number) => void): RevealClock {
  let raf = 0;
  let start = 0;
  let played = 0;

  const at = (seconds: number) => {
    const p = props.current;
    return Math.max(0, Math.min(1, (seconds - p.delay) / Math.max(0.001, p.duration)));
  };
  const write = (p: number) => {
    played = p;
    setPlayed(p);
  };

  function tick(now: number) {
    raf = 0;
    write(at((now - start) / 1000));
    if (played < 1) raf = requestAnimationFrame(tick);
  }

  /** Start or resume the timed reveal (idempotent; a finished reveal stays;
   * a manual `progress` has no clock of its own to run). */
  function play() {
    const p = props.current;
    if (p.progress !== undefined || raf || played >= 1) return;
    if (isDirected()) {
      seekTo(directedTime() ?? 0);
      return;
    }
    if (pixelPrefersReducedMotion()) {
      write(1);
      return;
    }
    start = performance.now() - (p.delay + played * p.duration) * 1000;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function seekTo(ms: number) {
    stop();
    write(at(ms / 1000));
  }

  function restart() {
    stop();
    write(0);
    play();
  }

  return { play, stop, seekTo, restart };
}

/**
 * DitherReveal — ordered-dither reveal of any content: a threshold sweep
 * through a Bayer (or seeded) matrix becomes a CSS mask (`wipe.ts`), played
 * on the kit clock or driven by a manual `progress`. `data-reveal` reports
 * hidden | playing | shown.
 *
 * Port of DitherReveal.vue: the clock is created once and reads the latest
 * props through a Box; effects own the in-view gate, the kit-clock
 * subscription, the ResizeObserver and teardown.
 */
export function DitherReveal({
  progress,
  duration = 1.2,
  delay = 0,
  direction = "none",
  cell = 4,
  band = 12,
  seed,
  reverse = false,
  easing = "ease-in-out",
  restartKey,
  className,
  style,
  children,
  ...rest
}: DitherRevealProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [played, setPlayed] = useState(0);
  const clockProps: RevealClockProps = { progress, duration, delay };
  const live = useRef(clockProps);
  live.current = clockProps;
  const clockRef = useRef<RevealClock | null>(null);
  const clock = (clockRef.current ??= createRevealClock(live, setPlayed));

  useInviewLoop(wrapRef, clock.play, clock.stop);

  // Vue's watch(() => props.restartKey, restart) — on a change only.
  const seenKey = useRef(restartKey);
  useEffect(() => {
    if (Object.is(seenKey.current, restartKey)) return;
    seenKey.current = restartKey;
    clock.restart();
  }, [clock, restartKey]);

  // Mount: follow the kit clock and measure the box; tear both down on unmount.
  useEffect(() => {
    const unseek = onSeek((ms) => (ms === null ? clock.play() : clock.seekTo(ms)));
    const el = wrapRef.current;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    if (el) {
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(([entry]) => {
          if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        ro.observe(el);
      } else raf = requestAnimationFrame(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    }
    return () => {
      unseek();
      clock.stop();
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [clock]);

  const ease = useMemo(() => resolveEasing(easing), [easing]);
  const raw = progress === undefined ? ease(played) : Math.max(0, Math.min(1, progress));
  const effective = reverse ? 1 - raw : raw;
  const mask = useMemo(
    () =>
      wipeStyle(effective, {
        cell,
        seed,
        direction,
        band,
        width: size.width,
        height: size.height,
      }),
    [effective, cell, seed, direction, band, size.width, size.height],
  );
  const maskStyle: CSSProperties | undefined = mask
    ? {
        maskImage: mask.image,
        WebkitMaskImage: mask.image,
        maskSize: mask.size,
        WebkitMaskSize: mask.size,
        maskRepeat: mask.repeat,
        WebkitMaskRepeat: mask.repeat,
        maskPosition: mask.position,
        WebkitMaskPosition: mask.position,
      }
    : undefined;
  const state = effective >= 1 ? "shown" : effective <= 0 ? "hidden" : "playing";

  return (
    <div
      {...rest}
      ref={wrapRef}
      className={cn("relative", className)}
      style={{ ...maskStyle, ...style }}
      data-reveal={state}
    >
      {children}
    </div>
  );
}

export default DitherReveal;
