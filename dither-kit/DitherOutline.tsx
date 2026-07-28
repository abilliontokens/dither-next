"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { BAYER4, clamp01, fillOf, pixelMatrixFromSeed, pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;

export interface DitherOutlineItem {
  /** Must match the `id` of a heading element in the document. */
  id: string;
  label: string;
  /** Nesting depth (0 = top level); drives indentation. */
  depth?: number;
}

export interface DitherOutlineProps {
  items: DitherOutlineItem[];
  /** Extra offset applied when scrolling to a heading and when computing the
   *  active item (e.g. a sticky header height). */
  offset?: number;
  /** Called with the id of the heading the user jumped to. */
  onNavigate?: (id: string) => void;
  color?: PixelColor;
  seed?: number;
  /** Accessible label for the navigation (default "On this page"). */
  label?: string;
  className?: string;
}

/** Paint the vertical progress rail: a downward-fading Bayer ramp that fills
 *  `progress` of the height, over a faint full-height track. Same recipe as the
 *  DitherAccordion rail, grown by scroll position. */
function paintProgressRail(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
  progress: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const h = canvas.offsetHeight;
  if (!ctx || h <= 0) return;
  const rows = Math.max(4, Math.round(h / CELL));
  canvas.width = 1;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, 1, rows);
  const filled = Math.round(clamp01(progress) * rows);
  for (let y = 0; y < rows; y++) {
    let alpha: number;
    if (y < filled) {
      const density = 1 - (y + 0.5) / rows;
      const lit = density > matrix[y & 3][0];
      alpha = lit ? 0.45 + 0.5 * density : 0.12 * density;
    } else {
      const lit = 0.12 > matrix[y & 3][0];
      alpha = lit ? 0.12 : 0.03;
    }
    if (alpha <= 0.004) continue;
    ctx.fillStyle = rgb(fill, 1, alpha);
    ctx.fillRect(0, y, 1, 1);
  }
}

/**
 * DitherOutline — a scroll-spy table of contents. Each `item.id` is resolved to
 * a DOM heading and watched; the active heading is marked `aria-current`, and a
 * **vertical Bayer progress rail** fills as the viewport descends the tracked
 * region (the same dither ramp recipe as DitherAccordion's rail, grown by scroll
 * progress instead of fixed height).
 *
 * Clicking an item smooth-scrolls to its heading — instantly under reduced
 * motion. Full keyboard support: the list is a real set of anchor links with
 * roving tabindex; Arrow Up/Down walk items, Home/End jump to the ends, and
 * Enter/Space follows the focused link natively.
 *
 * SSR-safe: no `window`/`document`/`IntersectionObserver` is touched during
 * render — all observation lives in effects. The initial active item is
 * `items[0]` and the rail is painted after mount.
 */
export function DitherOutline({
  items,
  offset = 0,
  onNavigate,
  color: colorProp,
  seed,
  label = "On this page",
  className,
}: DitherOutlineProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const railRef = useRef<HTMLCanvasElement | null>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const [still, setStill] = useState(false);
  const [focusId, setFocusId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => { setStill(pixelPrefersReducedMotion()); }, []);


  const recompute = useCallback(() => {
    if (typeof window === "undefined") return;
    let firstTop = Infinity;
    let lastBottom = -Infinity;
    const abs: number[] = [];
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (!el) {
        abs.push(0);
        continue;
      }
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      const bottom = top + el.offsetHeight;
      abs.push(top);
      if (top < firstTop) firstTop = top;
      if (bottom > lastBottom) lastBottom = bottom;
    }
    const scrollY = window.scrollY;
    let active = items[0]?.id ?? "";
    for (let i = 0; i < abs.length; i++) {
      if (abs[i] <= scrollY + 1) active = items[i].id;
    }
    const span = lastBottom - firstTop;
    const ratio = span > 0 ? (scrollY - firstTop) / span : 0;
    setActiveId(active);
    setProgress(clamp01(ratio));
  }, [items, offset]);

  useEffect(() => {
    recompute();
    if (typeof window === "undefined") return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [recompute]);

  // Repaint the rail whenever progress/colour/size changes.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      if (railRef.current) paintProgressRail(railRef.current, color, matrix, progress);
    };
    const raf = requestAnimationFrame(paint);
    if (typeof ResizeObserver !== "undefined" && railRef.current) {
      ro = new ResizeObserver(paint);
      ro.observe(railRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [color, matrix, progress]);

  const goTo = useCallback(
    (id: string) => {
      if (typeof document === "undefined") return;
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      if (still) window.scrollTo({ top, behavior: "auto" });
      else window.scrollTo({ top, behavior: "smooth" });
      setFocusId(id);
      queueMicrotask(() => linkRefs.current.get(id)?.focus());
      onNavigate?.(id);
    },
    [offset, still, onNavigate],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const idx = items.findIndex((it) => it.id === focusId);
      if (idx < 0) return;
      let next = -1;
      switch (e.key) {
        case "ArrowDown": next = Math.min(items.length - 1, idx + 1); break;
        case "ArrowUp": next = Math.max(0, idx - 1); break;
        case "Home": next = 0; break;
        case "End": next = items.length - 1; break;
        default: return;
      }
      e.preventDefault();
      const target = items[next];
      if (target) {
        setFocusId(target.id);
        queueMicrotask(() => linkRefs.current.get(target.id)?.focus());
      }
    },
    [items, focusId],
  );

  return (
    <nav aria-label={label} className={cn("flex gap-2", className)}>
      <div className="relative w-[3px] shrink-0 self-stretch">
        <canvas
          ref={railRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <ul role="list" className="min-w-0 flex-1 py-0.5" onKeyDown={onKeyDown}>
        {items.map((it) => {
          const depth = it.depth ?? 0;
          const isActive = it.id === activeId;
          const isFocused = it.id === focusId;
          return (
            <li key={it.id} role="listitem">
              <a
                href={`#${it.id}`}
                ref={(el) => {
                  if (el) linkRefs.current.set(it.id, el);
                  else linkRefs.current.delete(it.id);
                }}
                tabIndex={isFocused ? 0 : -1}
                aria-current={isActive ? "location" : undefined}
                onFocus={() => setFocusId(it.id)}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(it.id);
                }}
                style={{ paddingLeft: `${depth * 12}px` }}
                className={cn(
                  "block truncate rounded-[2px] py-1 pr-2 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 motion-reduce:transition-none",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
