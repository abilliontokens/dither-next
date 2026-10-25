"use client";

// One layer of a stage: its keyframes sampled at the stage's moment, written
// as a CSS transform that keeps the keyframes' units (the browser measures the
// container), and handed to the render prop as px against the measured box
// for painters. Any content — a kit canvas surface, an SVG, text — rides it.
//
// React port of DitherLayer.vue: `inject(STAGE, null)` becomes
// `useContext(STAGE)`, the scoped slot a render-prop `children`, and the
// global `.dither-layer { position: absolute; inset: 0 }` rule the
// `absolute inset-0` utilities beside the kept `dither-layer` class.

import {
  useContext,
  useMemo,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { STAGE } from "./DitherStage";
import {
  compileTrack,
  keyframeTransform,
  resolveSample,
  sampleKeyframes,
  type CqBox,
  type KeyEasing,
  type Keyframe,
} from "./keyframes";
import { cn } from "./lib";

/** What the render prop receives: every property resolved to px / degrees, then the moment's shape. */
export type LayerSlot = {
  [resolved: string]: number;
  progress: number;
  cycle: number;
  time: number;
  width: number;
  height: number;
};

export interface DitherLayerProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The track: { at?, easing?, x, y, rotate, scale, scaleX, scaleY, skewX, skewY, opacity, ...custom } per key. */
  keyframes?: Keyframe[];
  /** Seconds of one cycle; unset, the last key's `at` in seconds, else 1. */
  duration?: number;
  delay?: number;
  /** Cycles: a count, or true forever. */
  loop?: number | boolean;
  yoyo?: boolean;
  easing?: KeyEasing;
  /** transform-origin — container units welcome. */
  origin?: string;
  as?: ElementType;
  className?: string;
  /** Content, or a render prop receiving the resolved sample. */
  children?: ReactNode | ((slot: LayerSlot) => ReactNode);
}

const NO_KEYS: Keyframe[] = [];
const NONE: CqBox = { width: 0, height: 0 };
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export function DitherLayer({
  keyframes = NO_KEYS,
  duration,
  delay = 0,
  loop = 1,
  yoyo = false,
  easing,
  origin = "50% 50%",
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: DitherLayerProps) {
  const stage = useContext(STAGE);
  const time = stage?.reduced ? Infinity : (stage?.time ?? 0);
  const box = stage?.box ?? NONE;
  const track = useMemo(
    () => compileTrack({ keyframes, duration, delay, loop, yoyo, easing }),
    [keyframes, duration, delay, loop, yoyo, easing],
  );
  const sample = sampleKeyframes(track, time);
  const resolved = resolveSample(sample, box);

  const layerStyle: Record<string, string> = {
    transform: keyframeTransform(sample),
    transformOrigin: origin,
    "--layer-p": fmt(sample.progress),
  };
  if (sample.numbers.opacity !== undefined) layerStyle.opacity = fmt(sample.numbers.opacity);
  for (const [name, value] of Object.entries(resolved))
    layerStyle[`--layer-${name}`] = name in sample.lengths ? `${fmt(value)}px` : fmt(value);

  const content =
    typeof children === "function"
      ? children({
          ...resolved,
          progress: sample.progress,
          cycle: sample.cycle,
          time: Number.isFinite(time) ? time : 0,
          width: box.width,
          height: box.height,
        })
      : children;

  return (
    <Tag
      {...rest}
      className={cn("dither-layer absolute inset-0", className)}
      style={{ ...(layerStyle as CSSProperties), ...style }}
      data-layer={sample.state}
    >
      {content}
    </Tag>
  );
}

export default DitherLayer;
