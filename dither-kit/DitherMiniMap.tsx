"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
const MAX_STRIP_CELLS = 64; // minimap resolution cap (rows/cols along the axis)

/** Paint the density strip. Each backing row (vertical) or column (horizontal)
 *  is a slice of the document; its density drives the Bayer threshold so a
 *  tall/clumped slice reads as dense dither and an empty one as sparse. The
 *  strip IS the dither — intensity expressed as ordered-dither cells, never
 *  opacity. */
function paintStrip(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
  density: number[],
  vertical: boolean,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  if (!ctx || w <= 0 || h <= 0) return;
  const cells = Math.min(MAX_STRIP_CELLS, Math.max(4, Math.round((vertical ? h : w) / CELL)));
  const cross = Math.max(1, Math.round((vertical ? w : h) / CELL));
  canvas.width = vertical ? cross : cells;
  canvas.height = vertical ? cells : cross;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < cells; i++) {
    // Resample density to the backing cell count.
    const d = density.length
      ? density[Math.min(density.length - 1, Math.round((i / cells) * density.length))]
      : 0.3;
    for (let c = 0; c < cross; c++) {
      const my = vertical ? i : c;
      const mx = vertical ? c : i;
      const lit = d > matrix[my & 3][mx & 3];
      const alpha = lit ? 0.3 + 0.65 * d : 0.08 * d;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(mx, my, 1, 1);
    }
  }
}

export interface DitherMiniMapProps {
  /** Element to mirror. Falls back to the nearest scrollable ancestor, then
   *  to the window. */
  target?: RefObject<HTMLElement | null>;
  orientation?: "vertical" | "horizontal";
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/**
 * DitherMiniMap — a document minimap: a compressed dithered density strip
 * representing a scrollable element's content, with a draggable viewport lens.
 *
 * The natural companion to `DitherScrollProgress`: that one is a thin progress
 * bar, this one is a real overview. The strip is painted from a live density
 * histogram of the target's children (taller/clumped regions read as denser
 * Bayer cells) and repainted on layout change via `ResizeObserver`. The lens
 * tracks the target's scroll; click or drag the lens (or focus it and use
 * PageUp/PageDown/Home/End/Arrows) to scroll the target. Resolves the target
 * from a `ref` prop → nearest scrollable ancestor → window.
 *
 * `role="scrollbar"` with `aria-controls` (the target's id when known),
 * `aria-orientation`, and `aria-valuenow/min/max` (scroll percent). SSR-safe:
 * the scroller is resolved inside an effect; render never touches the DOM.
 */
export function DitherMiniMap({
  target,
  orientation = "vertical",
  color: colorProp,
  seed,
  className,
}: DitherMiniMapProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;
  const vertical = orientation === "vertical";

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLCanvasElement | null>(null);
  const reactId = useId();
  const lensId = `dk-minimap-${reactId.replace(/:/g, "")}`;

  // progress (0..1) + lensFraction (0..1) drive the lens DOM → state.
  const [view, setView] = useState({ progress: 0, lens: 1 });
  // density + target id live in refs (read by paint/ARIA, not render layout).
  const densityRef = useRef<number[]>([]);
  const targetIdRef = useRef<string | undefined>(undefined);

  const readScroller = useCallback((): { el: HTMLElement | Window; node: HTMLElement | null } | null => {
    if (target?.current) return { el: target.current, node: target.current };
    // Nearest scrollable ancestor of the minimap root.
    let p = rootRef.current?.parentElement ?? null;
    while (p) {
      const o = getComputedStyle(p).overflow;
      if (o === "auto" || o === "scroll" || o === "overlay" || p.scrollHeight > p.clientHeight + 1) {
        return { el: p, node: p };
      }
      p = p.parentElement;
    }
    if (typeof window !== "undefined") return { el: window, node: document.scrollingElement as HTMLElement | null };
    return null;
  }, [target]);

  const metricsOf = useCallback((el: HTMLElement | Window) => {
    if (el instanceof Window) {
      const doc = document.documentElement;
      const scrollLen = vertical ? doc.scrollHeight : doc.scrollWidth;
      const clientLen = vertical ? doc.clientHeight : doc.clientWidth;
      return {
        scrollLen,
        clientLen,
        max: Math.max(0, scrollLen - clientLen),
        pos: vertical ? window.scrollY : window.scrollX,
      };
    }
    const scrollLen = vertical ? el.scrollHeight : el.scrollWidth;
    const clientLen = vertical ? el.clientHeight : el.clientWidth;
    return {
      scrollLen,
      clientLen,
      max: Math.max(0, scrollLen - clientLen),
      pos: vertical ? el.scrollTop : el.scrollLeft,
    };
  }, [vertical]);

  const setScroll = useCallback((pos: number) => {
    const res = readScroller();
    if (!res) return;
    if (res.el instanceof Window) {
      window.scrollTo(vertical ? { top: pos } : { left: pos });
    } else {
      if (vertical) res.el.scrollTop = pos;
      else res.el.scrollLeft = pos;
    }
  }, [readScroller, vertical]);

  // Sample children into a density histogram (one bucket per strip cell).
  const recomputeDensity = useCallback((node: HTMLElement | null, scrollLen: number) => {
    if (!node || scrollLen <= 0) { densityRef.current = []; return; }
    const stripEl = stripRef.current;
    const stripPx = stripEl ? (vertical ? stripEl.offsetHeight : stripEl.offsetWidth) : 0;
    const cells = Math.min(MAX_STRIP_CELLS, Math.max(4, Math.round(stripPx / CELL)));
    const buckets = new Array<number>(cells).fill(0);
    const slice = scrollLen / cells;
    const hostRect = node.getBoundingClientRect();
    const kids = (node === document.scrollingElement ? document.body : node).children;
    for (let k = 0; k < kids.length; k++) {
      const r = (kids[k] as HTMLElement).getBoundingClientRect();
      const start = (vertical ? r.top : r.left) - (vertical ? hostRect.top : hostRect.left);
      const len = vertical ? r.height : r.width;
      const a = Math.max(0, start);
      const b = start + len;
      const from = Math.max(0, Math.floor(a / slice));
      const to = Math.min(cells - 1, Math.ceil(b / slice));
      for (let i = from; i <= to; i++) {
        const lo = Math.max(a, i * slice);
        const hi = Math.min(b, (i + 1) * slice);
        buckets[i] += Math.max(0, hi - lo);
      }
    }
    // Normalize: each bucket's covered-fraction of its slice, then scale to
    // the strip's maxima so the densest region reads near-solid.
    const frac = buckets.map((v) => v / slice);
    const max = frac.reduce((m, v) => Math.max(m, v), 0) || 1;
    densityRef.current = frac.map((v) => Math.min(1, v / max));
  }, [vertical]);

  // Single mount effect: resolve scroller, wire scroll listener + observers,
  // measure, paint. All cleanup lives here.
  useEffect(() => {
    const res = readScroller();
    if (!res) return;
    const { el, node } = res;
    if (node) targetIdRef.current = node.id || undefined;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const m = metricsOf(el);
      const progress = m.max > 0 ? m.pos / m.max : 0;
      const lens = m.scrollLen > 0 ? Math.min(1, m.clientLen / m.scrollLen) : 1;
      setView({ progress, lens });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    const repaint = () => {
      const m = metricsOf(el);
      recomputeDensity(node, m.scrollLen);
      if (stripRef.current) paintStrip(stripRef.current, color, matrix, densityRef.current, vertical);
      measure();
    };

    const rafInit = requestAnimationFrame(repaint);
    (el instanceof Window ? window : el).addEventListener("scroll", onScroll, { passive: true });

    let roTarget: ResizeObserver | null = null;
    let roSelf: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      roTarget = new ResizeObserver(repaint);
      if (node) roTarget.observe(node);
      // Observe the document body for window mode (layout shifts change height).
      if (el instanceof Window && document.body) roTarget.observe(document.body);
      roSelf = new ResizeObserver(repaint);
      if (rootRef.current) roSelf.observe(rootRef.current);
    }

    return () => {
      cancelAnimationFrame(rafInit);
      if (raf) cancelAnimationFrame(raf);
      (el instanceof Window ? window : el).removeEventListener("scroll", onScroll);
      roTarget?.disconnect();
      roSelf?.disconnect();
    };
    // Re-run when resolution inputs change.
  }, [readScroller, metricsOf, recomputeDensity, color, matrix, vertical]);

  // --- lens drag (pointer) ---
  const draggingRef = useRef(false);
  const onLensPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
    },
    [],
  );
  const onLensPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const res = readScroller();
      const track = stripRef.current;
      if (!res || !track) return;
      const r = track.getBoundingClientRect();
      const t = vertical
        ? (e.clientY - r.top) / Math.max(1, r.height)
        : (e.clientX - r.left) / Math.max(1, r.width);
      const clamped = Math.min(1, Math.max(0, t));
      const m = metricsOf(res.el);
      // Centre the lens on the pointer, clamped to the scroll range.
      const centre = clamped * m.scrollLen - m.clientLen / 2;
      setScroll(Math.min(m.max, Math.max(0, centre)));
    },
    [readScroller, metricsOf, setScroll, vertical],
  );
  const onLensPointerUp = useCallback(() => { draggingRef.current = false; }, []);

  const onKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const res = readScroller();
      if (!res) return;
      const m = metricsOf(res.el);
      const page = m.clientLen;
      const step = Math.max(40, page / 4);
      let pos: number | null = null;
      const back = vertical ? "ArrowUp" : "ArrowLeft";
      const fwd = vertical ? "ArrowDown" : "ArrowRight";
      switch (e.key) {
        case back: pos = m.pos - step; break;
        case fwd: pos = m.pos + step; break;
        case "PageUp": pos = m.pos - page; break;
        case "PageDown": pos = m.pos + page; break;
        case "Home": pos = 0; break;
        case "End": pos = m.max; break;
      }
      if (pos === null) return;
      e.preventDefault();
      setScroll(Math.min(m.max, Math.max(0, pos)));
    },
    [readScroller, metricsOf, setScroll, vertical],
  );

  const now = Math.round(view.progress * 100);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative rounded-[2px] bg-card/30",
        vertical ? "h-full w-3" : "h-3 w-full",
        className,
      )}
    >
      <canvas
        ref={stripRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <div
        id={lensId}
        role="scrollbar"
        tabIndex={0}
        aria-orientation={orientation}
        aria-controls={targetIdRef.current}
        aria-valuenow={now}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Scroll overview, ${now} percent`}
        onPointerDown={onLensPointerDown}
        onPointerMove={onLensPointerMove}
        onPointerUp={onLensPointerUp}
        onPointerCancel={onLensPointerUp}
        onKeyDown={onKeydown}
        className={cn(
          "absolute cursor-pointer rounded-[2px] border border-foreground/70 bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
          vertical ? "left-0 w-full" : "top-0 h-full",
        )}
        style={
          vertical
            ? { top: `${view.progress * (100 - view.lens * 100)}%`, height: `${view.lens * 100}%` }
            : { left: `${view.progress * (100 - view.lens * 100)}%`, width: `${view.lens * 100}%` }
        }
      />
    </div>
  );
}
