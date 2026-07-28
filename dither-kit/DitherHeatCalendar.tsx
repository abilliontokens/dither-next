"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
const TILE = 4; // Bayer tile per cell (4×4 backing px)
const GAP = 1; // backing px between cells
const CELL_CSS = TILE * CELL; // 8px
const GAP_CSS = GAP * CELL; // 2px

export type DitherHeatValue = { date: string; value: number };

export interface DitherHeatCalendarProps {
  values: DitherHeatValue[];
  /** Inclusive start (yyyy-mm-dd). Defaults to ~1 year back, Sunday-aligned. */
  from?: string;
  /** Inclusive end (yyyy-mm-dd). Defaults to today (UTC). */
  to?: string;
  /** Intensity buckets 1..N (0 = empty). Default 5. */
  levels?: number;
  color?: PixelColor;
  seed?: number;
  className?: string;
  onSelect?: (date: string) => void;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type Day = { iso: string; date: Date; value: number; level: number } | null;

/** Paint the whole grid in one pass — each cell is a full 4×4 Bayer tile whose
 *  threshold density encodes the intensity level, so a level-1 cell reads as a
 *  few sparse pixels and a top-level cell reads near-solid. This is the kit's
 *  core identity: intensity expressed as ordered-dither cells, never opacity. */
function paintHeat(
  canvas: HTMLCanvasElement,
  weeks: Day[][],
  levels: number,
  color: PixelColor,
  matrix: number[][],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const W = weeks.length;
  if (!ctx || W === 0) return;
  const cols = W * TILE + (W - 1) * GAP;
  const rows = 7 * TILE + 6 * GAP;
  canvas.width = cols;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, cols, rows);
  for (let w = 0; w < W; w++) {
    for (let d = 0; d < 7; d++) {
      const cell = weeks[w][d];
      const level = cell ? cell.level : 0;
      const density = level <= 0 ? 0.08 : level / levels;
      const x0 = w * (TILE + GAP);
      const y0 = d * (TILE + GAP);
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const lit = density > matrix[(y0 + py) & 3][(x0 + px) & 3];
          const alpha = lit ? 0.35 + 0.6 * density : 0.1 * density;
          if (alpha <= 0.004) continue;
          ctx.fillStyle = rgb(fill, 1, alpha);
          ctx.fillRect(x0 + px, y0 + py, 1, 1);
        }
      }
    }
  }
}

/** Paint a single legend swatch at a given level density (same recipe). */
function paintSwatch(canvas: HTMLCanvasElement, level: number, levels: number, color: PixelColor, matrix: number[][]): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  canvas.width = TILE;
  canvas.height = TILE;
  const fill = fillOf(color);
  const density = level <= 0 ? 0.08 : level / levels;
  ctx.clearRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const alpha = lit ? 0.35 + 0.6 * density : 0.1 * density;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * DitherHeatCalendar — a contribution-style calendar (weeks as columns,
 * weekdays as rows) whose intensity is rendered through the kit's ordered-
 * dither ramp: each value is bucketed into `levels` and each cell painted as a
 * full 4×4 Bayer tile, so low values read as sparse pixels and high values as
 * near-solid — never opacity.
 *
 * Accessible as a `role="grid"` (7 weekday rows, each a `role="row"` with a
 * rowheader + one `role="gridcell"` per week). Each cell carries an
 * aria-label ("3 entries on 2026-03-04"); cells are keyboard-navigable
 * (ArrowUp/Down move between weekday rows, ArrowLeft/Right within a row,
 * Home/End jump to the row ends) and selecting a cell fires `onSelect(date)`.
 * A legend (Less → More) is rendered with the same Bayer swatches.
 *
 * SSR-safe: dates are computed in UTC; all canvas painting happens in effects;
 * ids from `useId()`.
 */
export function DitherHeatCalendar({
  values,
  from,
  to,
  levels = 5,
  color: colorProp,
  seed,
  className,
  onSelect,
}: DitherHeatCalendarProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "green";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;
  const lvls = Math.max(1, Math.round(levels));

  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v.date, v.value);
    return m;
  }, [values]);
  const maxValue = useMemo(
    () => values.reduce((mx, v) => (v.value > mx ? v.value : mx), 0) || 1,
    [values],
  );

  const { weeks, monthMarks } = useMemo(() => {
    const today = new Date();
    const toD = parseISO(to ?? toISO(today));
    let fromD = from ? parseISO(from) : new Date(toD);
    if (!from) fromD.setUTCDate(fromD.getUTCDate() - 364);
    // Align fromD to its week's Sunday.
    fromD.setUTCDate(fromD.getUTCDate() - fromD.getUTCDay());

    const out: Day[][] = [];
    const marks: { week: number; label: string }[] = [];
    const cursor = new Date(fromD);
    let wi = 0;
    while (cursor <= toD) {
      const week: Day[] = [];
      const sundayMonth = cursor.getUTCMonth();
      if (cursor.getUTCDate() <= 7) marks.push({ week: wi, label: MONTH[sundayMonth] });
      for (let dow = 0; dow < 7; dow++) {
        if (cursor > toD) {
          week.push(null);
        } else {
          const iso = toISO(cursor);
          const value = valueMap.get(iso) ?? 0;
          const level = value > 0 ? Math.max(1, Math.min(lvls, Math.ceil((value / maxValue) * lvls))) : 0;
          week.push({ iso, date: new Date(cursor), value, level });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      out.push(week);
      wi++;
    }
    return { weeks: out, monthMarks: marks };
  }, [from, to, valueMap, maxValue, lvls]);

  const W = weeks.length;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swatchRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Roving tabindex: focused {week, dow}.
  const [focus, setFocus] = useState<{ w: number; d: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const cellKey = (w: number, d: number) => `${w}-${d}`;

  const focusCell = useCallback((w: number, d: number) => {
    setFocus({ w, d });
    queueMicrotask(() => cellRefs.current.get(cellKey(w, d))?.focus());
  }, []);

  const onCellKeydown = useCallback(
    (w: number, d: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      let nw = w;
      let nd = d;
      let moved = false;
      switch (e.key) {
        case "ArrowRight": if (w + 1 < W) { nw = w + 1; moved = true; } break;
        case "ArrowLeft": if (w - 1 >= 0) { nw = w - 1; moved = true; } break;
        case "ArrowDown": if (d + 1 < 7) { nd = d + 1; moved = true; } break;
        case "ArrowUp": if (d - 1 >= 0) { nd = d - 1; moved = true; } break;
        case "Home": nw = 0; moved = true; break;
        case "End": nw = W - 1; moved = true; break;
      }
      if (!moved) return;
      e.preventDefault();
      focusCell(nw, nd);
    },
    [W, focusCell],
  );

  // Paint grid + legend swatches after mount and on data/colour/resize change.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      if (canvasRef.current) paintHeat(canvasRef.current, weeks, lvls, color, matrix);
      for (let l = 0; l <= lvls; l++) {
        const c = swatchRefs.current[l];
        if (c) paintSwatch(c, l, lvls, color, matrix);
      }
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && canvasRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(canvasRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [weeks, lvls, color, matrix]);

  const gridWidth = W * CELL_CSS + (W - 1) * GAP_CSS;
  const gridHeight = 7 * CELL_CSS + 6 * GAP_CSS;

  return (
    <div className={cn("font-mono text-foreground", className)}>
      {/* Month labels (orientation only). */}
      <div className="relative mb-1 h-3" style={{ width: `${gridWidth}px` }} aria-hidden="true">
        {monthMarks.map((m) => (
          <span
            key={m.week}
            className="absolute text-[10px] text-muted-foreground"
            style={{ left: `${m.week * (CELL_CSS + GAP_CSS)}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-1">
        {/* Weekday row headers. */}
        <div className="flex flex-col gap-[2px] pr-1" aria-hidden="true">
          {WEEKDAY.map((wd, i) => (
            <span
              key={wd}
              className={cn("text-[10px] text-muted-foreground", i % 2 === 0 ? "opacity-0" : "")}
              style={{ height: `${CELL_CSS}px`, lineHeight: `${CELL_CSS}px` }}
            >
              {wd}
            </span>
          ))}
        </div>

        <div className="relative" style={{ width: `${gridWidth}px`, height: `${gridHeight}px` }}>
          {/* One dither canvas behind the whole grid. */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0"
            style={{ width: `${gridWidth}px`, height: `${gridHeight}px`, imageRendering: "pixelated" }}
          />
          {/* Focusable cell grid overlay — transparent, one button per cell. */}
          <div
            role="grid"
            aria-label="Activity calendar"
            aria-rowcount={7}
            aria-colcount={W}
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${W}, ${CELL_CSS}px)`, gridTemplateRows: `repeat(7, ${CELL_CSS}px)`, columnGap: `${GAP_CSS}px`, rowGap: `${GAP_CSS}px` }}
          >
            {Array.from({ length: 7 }, (_, d) => (
              <div role="row" aria-rowindex={d + 1} key={`row-${d}`} className="contents">
                {weeks.map((week, w) => {
                  const cell = week[d];
                  if (!cell) {
                    return <span role="gridcell" key={`empty-${w}-${d}`} aria-hidden="true" />;
                  }
                  const selected = focus?.w === w && focus?.d === d;
                  return (
                    <button
                      key={cell.iso}
                      ref={(el) => {
                        if (el) cellRefs.current.set(cellKey(w, d), el);
                        else cellRefs.current.delete(cellKey(w, d));
                      }}
                      role="gridcell"
                      tabIndex={selected ? 0 : -1}
                      aria-colindex={w + 1}
                      aria-label={`${cell.value} ${cell.value === 1 ? "entry" : "entries"} on ${cell.iso}`}
                      aria-selected={selected || undefined}
                      onFocus={() => setFocus({ w, d })}
                      onClick={() => onSelect?.(cell.iso)}
                      onKeyDown={onCellKeydown(w, d)}
                      className={cn(
                        "rounded-[1px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground",
                        selected && "ring-1 ring-foreground",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend: Less → More, same Bayer swatches. */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {Array.from({ length: lvls + 1 }, (_, l) => (
          <canvas
            key={l}
            ref={(el) => { swatchRefs.current[l] = el; }}
            aria-hidden="true"
            className="rounded-[1px]"
            style={{ width: `${CELL_CSS}px`, height: `${CELL_CSS}px`, imageRendering: "pixelated" }}
          />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}
