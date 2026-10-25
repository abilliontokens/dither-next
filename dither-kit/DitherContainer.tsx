"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { CONTAINER_SCALE, quantize, resolveCq, type CqScale, type CqState } from "./containers";
import { cn } from "./lib";

/** What render-prop children receive: the resolution plus the measured content box. */
export type ContainerSlot = CqState & { width: number; height: number };

export interface DitherContainerProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Bucket scale in container px — declaration order irrelevant. */
  scale?: CqScale;
  /** Quantize `--cq-w` / `--cq-h` to this many px (0 = continuous). */
  step?: number;
  /** Native `container-name` for `@container` rules in children's styles. */
  name?: string;
  as?: ElementType;
  className?: string;
  /** Content, or a render prop receiving the bucket resolution + measured box. */
  children?: ReactNode | ((state: ContainerSlot) => ReactNode);
}

type Size = { width: number; height: number };

/* Container-relative traverses — distances measure the QUERY CONTAINER
   (cqw/cqh), never the animated element's own box and never the viewport, so
   every frame re-scales when the container resizes. Without a container
   ancestor the units fall back to small-viewport sizes (CSS spec), which still
   reads as motion. Use via `animation: dither-cq-traverse …`. Global names by
   contract, so they ship as one hoisted, de-duplicated React <style> rather
   than a CSS module (whose keyframe names would be scoped). */
const CQ_KEYFRAMES = `@keyframes dither-cq-traverse {
  from { transform: translateX(-100cqw); }
  to { transform: translateX(100cqw); }
}
@keyframes dither-cq-rise {
  from { transform: translateY(-100cqh); }
  to { transform: translateY(100cqh); }
}`;

/** Round to whole px, never negative; keep `prev` when nothing changed. */
function measured(prev: Size, w: number, h: number): Size {
  const width = Math.max(0, Math.round(w));
  const height = Math.max(0, Math.round(h));
  return prev.width === width && prev.height === height ? prev : { width, height };
}

/**
 * DitherContainer — a size query container that resolves its measured width
 * against a named bucket scale (`containers.ts`) and hands the result to its
 * children: `--cq-w` / `--cq-h` / `--cq-i` custom properties, a `data-cq`
 * bucket attribute, a native `container-type` + `container-name`, and the
 * state itself through a render prop.
 *
 * Port of DitherContainer.vue: the scoped slot becomes a render-prop
 * `children`; onMounted + onBeforeUnmount collapse into one effect owning the
 * ResizeObserver and the first-paint fallback read.
 */
export function DitherContainer({
  scale = CONTAINER_SCALE,
  step = 0,
  name = "dither",
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: DitherContainerProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  /** 0 until the first observation — the honest pre-measure size. */
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let ro: ResizeObserver | null = null;
    // contentRect = the content box, i.e. exactly what `@container` measures,
    // and transform-proof (use-chart-dimensions precedent). Without a
    // ResizeObserver the state simply stays at the 0-size bucket.
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        const w = entry ? entry.contentRect.width : node.clientWidth;
        const h = entry ? entry.contentRect.height : node.clientHeight;
        setSize((prev) => measured(prev, w, h));
      });
      ro.observe(node);
    }
    // First-paint guard: if nothing reported (silent observer), read the box
    // once — but never overwrite a real observation with the zero read.
    const fallback = window.setTimeout(() => {
      setSize((prev) => (prev.width ? prev : measured(prev, node.clientWidth, node.clientHeight)));
    }, 0);
    return () => {
      clearTimeout(fallback);
      ro?.disconnect();
    };
  }, []);

  const state = useMemo(() => resolveCq(size.width, scale), [size.width, scale]);
  /** container-type/name make the node a native query container too — children
   * can use stylesheet `@container <name>` without any of this JS. */
  const boxStyle = {
    containerType: "inline-size",
    containerName: name,
    "--cq-w": String(step > 0 ? quantize(size.width, step) : size.width),
    "--cq-h": String(step > 0 ? quantize(size.height, step) : size.height),
    "--cq-i": String(state.index),
  } as CSSProperties;

  return (
    <>
      <style href="dither-cq-keyframes" precedence="default">
        {CQ_KEYFRAMES}
      </style>
      <Tag
        {...rest}
        ref={rootRef}
        className={cn("dither-container", className)}
        data-cq={state.size ?? undefined}
        style={{ ...boxStyle, ...style }}
      >
        {typeof children === "function"
          ? children({ ...state, width: size.width, height: size.height })
          : children}
      </Tag>
    </>
  );
}

export default DitherContainer;
