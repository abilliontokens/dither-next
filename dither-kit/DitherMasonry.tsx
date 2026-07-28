"use client";

import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn, ms, px } from "./lib";


type Breakpoints = Partial<Record<"base" | "sm" | "md" | "lg" | "xl", number>>;

/** Resolve a column count for the current width from a fixed number or a
 *  Tailwind-style breakpoint map (checked widest-first so the widest match
 *  wins). */
function resolveColumns(width: number, columns: number | Breakpoints): number {
  if (typeof columns === "number") return Math.max(1, Math.round(columns));
  const bp: [number, keyof Breakpoints][] = [
    [1280, "xl"],
    [1024, "lg"],
    [768, "md"],
    [640, "sm"],
  ];
  let count = columns.base ?? 1;
  for (const [w, k] of bp) {
    if (width >= w && columns[k] != null) {
      count = columns[k] as number;
      break;
    }
  }
  return Math.max(1, count);
}

/** A small Bayer veil tile (one period) used as the lift-off mask during the
 *  staggered reveal — the texture is the kit's, not a plain fade. */
function paintVeil(color: PixelColor, matrix: number[][]): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fill = fillOf(color);
  const density = 0.55;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const alpha = lit ? 0.5 : 0.06;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

export interface DitherMasonryProps {
  children: ReactNode;
  /** Column count, or a breakpoint map (`base`/`sm`/`md`/`lg`/`xl`). Default 3. */
  columns?: number | Breakpoints;
  /** Gap between items in px (default 12). */
  gap?: number;
  /** Stagger a dither-veil reveal on first layout (default true). */
  stagger?: boolean;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/**
 * DitherMasonry — a measured masonry/waterfall layout. Children are measured
 * with a `ResizeObserver` and distributed into N columns by shortest-column-
 * first, so the layout is driven by real heights, not estimates. `columns`
 * takes a fixed number or a breakpoint map (responsive to the container width).
 *
 * The reveal is the dither element: each item lifts in under a **Bayer veil**
 * (a tiled ordered-dither mask) that fades on a staggered delay, so the content
 * appears through the kit's texture rather than a plain opacity tween. Under
 * reduced motion the veil is skipped and items appear instantly.
 *
 * SSR-safe: until the first measurement commits, items render as a plain
 * single column (graceful, hydration-matched); the absolute positioning is
 * applied only after mount. All widths/tops reaching inline styles are rounded
 * through `px` (column widths are fractional, so this is load-bearing for
 * hydration).
 */
export function DitherMasonry({
  children,
  columns = 3,
  gap = 12,
  stagger = true,
  color: colorProp,
  seed,
  className,
}: DitherMasonryProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const items = useMemo(() => Children.toArray(children), [children]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Layout is state (read in render), not a ref: positions change on every
  // measure and the cards MUST re-render to follow them.
  const [layout, setLayout] = useState<{
    count: number;
    pos: { left: number; top: number; width: number }[];
    height: number;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [still, setStill] = useState(false);
  const [veil, setVeil] = useState<string | null>(null);

  useEffect(() => { setStill(pixelPrefersReducedMotion()); }, []);
  useEffect(() => { setVeil(paintVeil(color, matrix)); }, [color, matrix]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measureAndLayout = () => {
      const width = container.clientWidth;
      if (width <= 0) return;
      const count = resolveColumns(width, columns);
      const colW = (width - gap * (count - 1)) / count;
      const heights = new Array<number>(count).fill(0);
      const pos: { left: number; top: number; width: number }[] = [];
      for (let i = 0; i < items.length; i++) {
        const ref = itemRefs.current[i];
        const h = ref ? ref.offsetHeight : 0;
        let col = 0;
        for (let c = 1; c < count; c++) if (heights[c] < heights[col]) col = c;
        pos.push({ left: col * (colW + gap), top: heights[col], width: colW });
        heights[col] += h + gap;
      }
      let max = 0;
      for (const hgt of heights) if (hgt > max) max = hgt;
      setLayout({ count, pos, height: max });
    };
    const kick = requestAnimationFrame(measureAndLayout);
    if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(kick);
    const ro = new ResizeObserver(measureAndLayout);
    ro.observe(container);
    for (const r of itemRefs.current) if (r) ro.observe(r);
    return () => {
      cancelAnimationFrame(kick);
      ro.disconnect();
    };
  }, [items.length, columns, gap]);

  // Reveal once the first real layout commits; rAF so the initial paint lands.
  useEffect(() => {
    if (!layout) return;
    if (still || !stagger) {
      setRevealed(true);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [layout, still, stagger]);

  const step = 40;

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={layout ? { height: px(layout.height) } : undefined}
    >
      {items.map((child, i) => {
        const p = layout?.pos[i];
        const positioned = !!p;
        const delay = stagger && revealed ? ms(i * step) : undefined;
        const itemStyle: CSSProperties = positioned && p
          ? {
              position: "absolute",
              left: px(p.left),
              top: px(p.top),
              width: px(p.width),
              opacity: revealed ? 1 : 0,
              transform: revealed ? "none" : "translateY(8px)",
              transitionDelay: delay,
            }
          : { position: "relative", width: "100%" };
        return (
          <div
            key={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className={cn(
              "transition-[opacity,transform] duration-300 motion-reduce:transition-none",
            )}
            style={itemStyle}
          >
            {child}
            {stagger && !still && veil && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `url(${veil})`,
                  backgroundSize: "8px 8px",
                  opacity: revealed ? 0 : 1,
                  transition: "opacity 300ms",
                  transitionDelay: delay,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
