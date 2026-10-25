"use client";

// A stagger group: each direct child gets a track of the plan
// (`sequence.ts`), and the driver writes its progress as `--seq-p` and its
// state as `data-seq` on the child element — no re-render per frame.
//
// React port of Sequence.vue. The driver is created once and reads the
// latest props through a Box; the child writes stay imperative (React never
// owns `--seq-p` / `data-seq`, so it leaves them alone). The observer that
// doubles as start trigger and visibility gate, the kit-clock subscription
// and teardown live in one mount effect; restartKey / paused are on-change
// effects like Vue's non-immediate watchers.

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { directedTime, isDirected, onSeek } from "./clock";
import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { frameIndex, linear, type Easing } from "./timing";
import { planSequence, sampleSequence, type SequencePlan, type StaggerFrom } from "./sequence";

export interface DitherSequenceProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Seconds between neighbouring children's starts. */
  stagger?: number;
  /** Which end of the group starts first. */
  from?: StaggerFrom;
  /** One child's cycle, seconds. */
  duration?: number;
  /** Progress easing per cycle — timing.ts (`steps(4)` quantizes). */
  easing?: Easing;
  /** Whole cycles per child. */
  loop?: number;
  /** Odd cycles play in reverse (an even loop settles back at 0). */
  yoyo?: boolean;
  /** Seconds before the timeline starts (children sit at 0 until then). */
  delay?: number;
  paused?: boolean;
  /** Replay whenever the group scrolls back into view. */
  restartOnView?: boolean;
  /** Stop-motion cadence in fps (0 = smooth) — the kit-wide knob. */
  frameRate?: number;
  /** Bump to rebuild (children changed) and replay from the start. */
  restartKey?: string | number;
  onComplete?: () => void;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

type Box<T> = { readonly current: T };
type DriverProps = {
  stagger: number;
  from: StaggerFrom;
  duration: number;
  easing?: Easing;
  loop: number;
  yoyo: boolean;
  delay: number;
  paused: boolean;
  restartOnView: boolean;
  frameRate: number;
  onComplete?: () => void;
};
type SequenceDriver = {
  start: () => void;
  stop: () => void;
  wake: () => void;
  seekTo: (ms: number) => void;
  /** The observer's verdict: start / wake on entry, pause on exit. */
  view: (visible: boolean) => void;
  /** Vue's paused watcher body. */
  pause: (paused: boolean) => void;
};

/** The Vue driver verbatim, reading props through `props.current`. */
function createSequenceDriver(props: Box<DriverProps>, root: Box<HTMLElement | null>): SequenceDriver {
  let children: HTMLElement[] = [];
  let plan: SequencePlan = { tracks: [], duration: 0 };
  let raf = 0;
  let elapsed = 0;
  let lastDt = -1; // -1 sentinel: fake clocks legitimately start at 0
  let lastPaint = 0;
  let lastFrame = -1;
  let started = false;
  let finished = false;
  /** Last values written per child — skip style work when nothing changed. */
  let written: { p: string; s: string }[] = [];

  function write(progress: number, state: string, i: number): void {
    const child = children[i];
    if (!child) return;
    const p = progress.toFixed(4);
    const prev = written[i];
    if (prev && prev.p === p && prev.s === state) return;
    written[i] = { p, s: state };
    child.style.setProperty("--seq-p", p);
    child.setAttribute("data-seq", state);
  }

  function paint(t: number): void {
    for (const s of sampleSequence(plan, t)) write(s.progress, s.state, s.index);
  }

  function complete(): void {
    if (finished) return;
    finished = true;
    stop();
    paint(plan.duration); // settle every child at its terminal value
    props.current.onComplete?.();
  }

  function frame(now: number): void {
    raf = 0;
    const p = props.current;
    if (p.paused || isDirected()) return;
    // The clock ticks EVERY frame; the gates below only decide whether to write.
    // (Gating the clock itself would freeze the gate's own input.)
    const fps = p.frameRate;
    const cap = fps && fps > 0 ? Math.max(0.1, 2 / fps) : 0.1;
    const dt = lastDt >= 0 ? Math.min(cap, (now - lastDt) / 1000) : 0;
    lastDt = now;
    elapsed += dt;
    const t = elapsed - p.delay;
    if (t >= plan.duration) {
      complete();
      return;
    }
    const gate = fps && fps > 0 ? frameIndex(elapsed * 1000, fps) : -1;
    if (fps && fps > 0 ? gate === lastFrame : now - lastPaint < 33) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastFrame = gate;
    lastPaint = now;
    paint(t);
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Directed (clock.ts): the group sits at the given moment, no frames. */
  function seekTo(ms: number): void {
    stop();
    if (!started) return;
    elapsed = ms / 1000;
    const t = elapsed - props.current.delay;
    paint(Math.min(t, plan.duration));
  }

  function start(): void {
    stop();
    const p = props.current;
    const el = root.current;
    children = el ? Array.from(el.children).map((child) => child as HTMLElement) : [];
    written = children.map(() => ({ p: "", s: "" }));
    plan = planSequence({
      kind: "stagger",
      count: children.length,
      stagger: p.stagger,
      from: p.from,
      node: (i) => ({
        kind: "track",
        id: String(i),
        duration: p.duration,
        easing: p.easing ?? linear,
        loop: p.loop,
        yoyo: p.yoyo,
      }),
    });
    elapsed = 0;
    lastDt = -1;
    lastPaint = 0;
    lastFrame = -1;
    started = true;
    finished = false;
    if (children.length === 0) {
      finished = true;
      p.onComplete?.();
      return;
    }
    if (pixelPrefersReducedMotion()) {
      complete(); // reduced motion: settled end state, no frames requested
      return;
    }
    if (p.paused) {
      paint(0 - p.delay); // hold at the start state until released
      return;
    }
    if (isDirected()) {
      seekTo(directedTime() ?? 0);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function wake(): void {
    if (isDirected()) {
      seekTo(directedTime() ?? 0);
      return;
    }
    if (!raf && started && !finished && !props.current.paused) {
      lastDt = -1; // resume: the first frame back contributes dt 0 (no jump)
      raf = requestAnimationFrame(frame);
    }
  }

  function view(visible: boolean): void {
    if (visible) {
      if (!started || props.current.restartOnView) start();
      else wake();
    } else if (started && !finished) {
      stop();
    }
  }

  function pause(paused: boolean): void {
    if (paused) stop();
    else if (started && !finished && !pixelPrefersReducedMotion()) wake();
  }

  return { start, stop, wake, seekTo, view, pause };
}

/**
 * DitherSequence — staggers its direct children through one timeline: each
 * child's eased progress lands in `--seq-p` (0-1) and its state in
 * `data-seq` (before | active | done), for the children's own CSS to read.
 */
export function DitherSequence({
  stagger = 0.06,
  from = "start",
  duration = 0.5,
  easing,
  loop = 1,
  yoyo = false,
  delay = 0,
  paused = false,
  restartOnView = false,
  frameRate = 0,
  restartKey,
  onComplete,
  as: Tag = "div",
  className,
  children,
  ...rest
}: DitherSequenceProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const driverProps: DriverProps = {
    stagger,
    from,
    duration,
    easing,
    loop,
    yoyo,
    delay,
    paused,
    restartOnView,
    frameRate,
    onComplete,
  };
  const live = useRef(driverProps);
  live.current = driverProps;
  const driverRef = useRef<SequenceDriver | null>(null);
  const driver = (driverRef.current ??= createSequenceDriver(live, rootRef));

  useEffect(() => {
    const unseek = onSeek((ms) => (ms === null ? driver.wake() : driver.seekTo(ms)));
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      driver.start(); // no gate available — play on mount (AnimatedContent's floor)
    } else {
      // The observer doubles as start trigger AND visibility gate (loop-visibility
      // contract: no offscreen rAF). Leaving mid-play pauses the clock; re-entry
      // wakes with lastDt=-1, so no time jumps across the pause.
      io = new IntersectionObserver(([entry]) => driver.view(entry?.isIntersecting ?? true));
      if (rootRef.current) io.observe(rootRef.current);
    }
    return () => {
      unseek();
      driver.stop();
      io?.disconnect();
    };
  }, [driver]);

  // Vue's watch(() => props.restartKey, start) — on a change only.
  const seenKey = useRef(restartKey);
  useEffect(() => {
    if (Object.is(seenKey.current, restartKey)) return;
    seenKey.current = restartKey;
    driver.start();
  }, [driver, restartKey]);

  // Vue's watch(() => props.paused, …) — on a change only.
  const seenPaused = useRef(paused);
  useEffect(() => {
    if (seenPaused.current === paused) return;
    seenPaused.current = paused;
    driver.pause(paused);
  }, [driver, paused]);

  return (
    <Tag {...rest} ref={rootRef} className={cn("dither-sequence", className)}>
      {children}
    </Tag>
  );
}

export default DitherSequence;
