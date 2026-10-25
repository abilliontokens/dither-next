"use client";

// A stage: one size query container, one clock. Layers inside run keyframes
// in the stage's units — "20cqw" is a fifth of this box whatever its size —
// and read the stage's moment: free-running it is this rAF loop (visibility
// gated, stop-motion capable, looping over `duration`), directed it is the
// kit clock's, so a stage seeks and exports to video like any surface.
//
// React port of DitherStage.vue. `provide(STAGE, …)` becomes the STAGE
// context; its value carries the moment, the measured box and the
// reduced-motion flag as plain values (a new value per written moment, so
// layers re-render on the stage's cadence). The loop is created once and
// reads the latest props through a Box; effects own the in-view gate, the
// kit-clock subscription, observation and teardown.

import {
  createContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { directedTime, isDirected, onSeek } from "./clock";
import type { CqBox } from "./keyframes";
import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { frameIndex } from "./timing";
import { useInviewLoop } from "./use-inview-loop";

/** What layers read from their stage: the moment, the measured box, and
 * whether motion is reduced (every layer then sits at its settled end). */
export type StageContext = { time: number; box: CqBox; reduced: boolean };
export const STAGE = createContext<StageContext | null>(null);

/** What render-prop children receive. */
export type StageSlot = { time: number; width: number; height: number };

export interface DitherStageProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Seconds of one cycle of the stage's clock (it loops); unset, time runs on. */
  duration?: number;
  /** Clock multiplier. */
  speed?: number;
  paused?: boolean;
  /** Stop-motion cadence in fps (0 = smooth) — see timing.ts. */
  frameRate?: number;
  /** Change to restart from 0. */
  restartKey?: unknown;
  as?: ElementType;
  className?: string;
  /** Content, or a render prop receiving the moment and the measured box. */
  children?: ReactNode | ((slot: StageSlot) => ReactNode);
}

type Box<T> = { readonly current: T };
type StageClockProps = { duration?: number; speed: number; paused: boolean; frameRate: number };
type StageClock = {
  play: () => void;
  stop: () => void;
  seekTo: (ms: number) => void;
  restart: () => void;
};

/** The stage's clock — the Vue loop verbatim, reading props through `props.current`. */
function createStageClock(
  props: Box<StageClockProps>,
  reduced: Box<boolean>,
  setTime: (t: number) => void,
  setDirected: (directed: boolean) => void,
): StageClock {
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let lastFrame = -1;

  const wrap = (t: number): number => {
    const d = props.current.duration;
    return d && d > 0 ? ((t % d) + d) % d : t;
  };

  function frame(now: number): void {
    raf = 0;
    const p = props.current;
    if (p.paused || isDirected()) return;
    const fps = p.frameRate;
    const cap = fps > 0 ? Math.max(0.1, 2 / fps) : 0.1;
    const dt = last ? Math.min(cap, (now - last) / 1000) : 0;
    last = now;
    elapsed += dt * p.speed;
    // Stop-motion holds the written moment between boundaries; the clock keeps counting.
    const idx = fps > 0 ? frameIndex(elapsed * 1000, fps) : -1;
    if (fps <= 0 || idx !== lastFrame) {
      lastFrame = idx;
      setTime(wrap(elapsed));
    }
    raf = requestAnimationFrame(frame);
  }

  function play(): void {
    if (isDirected()) {
      seekTo(directedTime() ?? 0);
      return;
    }
    setDirected(false);
    if (reduced.current || props.current.paused || raf) return;
    last = 0;
    lastFrame = -1;
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Directed: the composition's moment (looped over `duration`), no frames. */
  function seekTo(ms: number): void {
    stop();
    setDirected(true);
    setTime(wrap((ms / 1000) * props.current.speed));
  }

  function restart(): void {
    stop();
    elapsed = 0;
    setTime(0);
    play();
  }

  return { play, stop, seekTo, restart };
}

/**
 * DitherStage — one size query container and one clock for the
 * `DitherLayer`s inside it (`containerType: size`, `--cq-w` / `--cq-h`,
 * `data-stage` = still | paused | directed | playing).
 */
export function DitherStage({
  duration,
  speed = 1,
  paused = false,
  frameRate = 0,
  restartKey,
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: DitherStageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [time, setTime] = useState(0);
  const [box, setBox] = useState<CqBox>({ width: 0, height: 0 });
  const [reduced, setReduced] = useState(false);
  /** Whether the kit clock holds the moment (state for the data attribute). */
  const [directed, setDirected] = useState(false);

  const clockProps: StageClockProps = { duration, speed, paused, frameRate };
  const live = useRef(clockProps);
  live.current = clockProps;
  const reducedBox = useRef(false);
  const clockRef = useRef<StageClock | null>(null);
  const clock = (clockRef.current ??= createStageClock(live, reducedBox, setTime, setDirected));

  // Vue read reduced motion during setup; reading it before paint keeps the
  // server markup and the hydration pass identical (no matchMedia on the
  // server) and runs ahead of the in-view gate's first play().
  useLayoutEffect(() => {
    const r = pixelPrefersReducedMotion();
    reducedBox.current = r;
    setReduced(r);
  }, []);

  useInviewLoop(rootRef, clock.play, clock.stop);

  // Mount: follow the kit clock and measure the box; tear both down on unmount.
  useEffect(() => {
    const unseek = onSeek((ms) => (ms === null ? clock.play() : clock.seekTo(ms)));
    const node = rootRef.current;
    let ro: ResizeObserver | null = null;
    if (node) {
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(([entry]) => {
          if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        ro.observe(node);
      } else setBox({ width: node.clientWidth, height: node.clientHeight });
    }
    return () => {
      unseek();
      clock.stop();
      ro?.disconnect();
    };
  }, [clock]);

  // Vue's watch(() => props.restartKey, restart) — on a change only.
  const seenKey = useRef(restartKey);
  useEffect(() => {
    if (Object.is(seenKey.current, restartKey)) return;
    seenKey.current = restartKey;
    clock.restart();
  }, [clock, restartKey]);

  // Vue's watch(() => props.paused, …) — on a change only.
  const seenPaused = useRef(paused);
  useEffect(() => {
    if (seenPaused.current === paused) return;
    seenPaused.current = paused;
    if (paused) clock.stop();
    else clock.play();
  }, [clock, paused]);

  const ctx = useMemo<StageContext>(() => ({ time, box, reduced }), [time, box, reduced]);
  const state = reduced ? "still" : paused ? "paused" : directed ? "directed" : "playing";
  const stageStyle = {
    containerType: "size",
    containerName: "stage",
    "--cq-w": String(Math.round(box.width)),
    "--cq-h": String(Math.round(box.height)),
  } as CSSProperties;

  return (
    <STAGE value={ctx}>
      <Tag
        {...rest}
        ref={rootRef}
        className={cn("dither-stage relative overflow-hidden", className)}
        style={{ ...stageStyle, ...style }}
        data-stage={state}
        data-stage-time={time.toFixed(2)}
      >
        {typeof children === "function"
          ? children({ time, width: box.width, height: box.height })
          : children}
      </Tag>
    </STAGE>
  );
}

export default DitherStage;
