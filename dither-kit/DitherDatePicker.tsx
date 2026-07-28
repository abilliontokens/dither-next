"use client";

import {
  useCallback,
  useEffect,
  useId,
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

/** ISO calendar date `yyyy-mm-dd` (local, no timezone juggling). */
export type DateISO = string;
/** Single-select value: an ISO date or `null`. */
export type DateSingleValue = DateISO | null;
/** Range-select value: an inclusive `[start, end]` pair (either may be null). */
export type DateRangeValue = { start: DateISO | null; end: DateISO | null };
/** Union of the two selection shapes; branch on `mode`. */
export type DateValue = DateSingleValue | DateRangeValue;

export type DatePickerMode = "single" | "range";

export interface DitherDatePickerProps {
  /** Selection shape. `single` → a `DateSingleValue`, `range` → `DateRangeValue`. */
  mode?: DatePickerMode;
  /** Controlled selection. */
  value: DateValue;
  onChange?: (value: DateValue) => void;
  /** 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Initial month in view (SSR-stable). Defaults to the value's month, else today. */
  defaultMonth?: { year: number; month: number };
  /** Earliest selectable date (inclusive). Cells before it are disabled. */
  min?: DateISO;
  /** Latest selectable date (inclusive). Cells after it are disabled. */
  max?: DateISO;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Localized column headers; defaults to the English SMTWTFS. */
  weekdayLabels?: string[];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function toISO(y: number, m: number, d: number): DateISO {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}
function fromISO(iso: DateISO | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
function cmp(a: DateISO | null, b: DateISO | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

type GridCell = {
  iso: DateISO;
  day: number;
  inMonth: boolean;
  index: number;
};

/** Build the fixed 6×7 grid for a month view. Lead/trail days belong to the
 *  neighbouring months so every week row is complete. JS Date normalizes month
 *  overflow, so day numbers < 1 or > daysInMonth resolve to the right date. */
function buildGrid(year: number, month: number, weekStartsOn: 0 | 1): GridCell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const startDay = 1 - lead;
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, startDay + i);
    const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
    cells.push({ iso, day: d.getDate(), inMonth: d.getMonth() === month, index: i });
  }
  return cells;
}

/** Resolve the cell's ordered-dither fill density (0–1). Selected edges read
 *  near-solid, the in-range band reads medium, today and hover read lighter,
 *  and plain in-month days carry a faint base so the grid has the kit's
 *  texture. Out-of-month cells are left empty (dimmed via text instead). */
function cellDensity(
  cell: GridCell,
  mode: DatePickerMode,
  single: DateISO | null,
  range: { start: DateISO | null; end: DateISO | null },
  today: DateISO | null,
  hovered: DateISO | null,
): number {
  if (!cell.inMonth) return 0;
  let d = 0.06;
  if (cell.iso === hovered) d = Math.max(d, 0.28);
  if (cell.iso === today) d = Math.max(d, 0.5);
  if (mode === "single") {
    if (cell.iso === single) d = 0.95;
  } else {
    const lo = range.start && range.end && cmp(range.start, range.end) > 0 ? range.end : range.start;
    const hi = range.start && range.end && cmp(range.start, range.end) > 0 ? range.start : range.end;
    if (cell.iso === lo || cell.iso === hi) d = Math.max(d, 0.95);
    else if (lo && hi && cmp(cell.iso, lo) > 0 && cmp(cell.iso, hi) < 0) d = Math.max(d, 0.34);
    else if (lo && !hi && cell.iso === lo) d = Math.max(d, 0.95);
  }
  return d;
}

/** Paint the whole 6×7 grid in one pass — each day cell is a Bayer region
 *  whose density encodes its state, so selection reads as dense ordered-dither
 *  pixels and the in-range band reads as a mid wash, never a smooth tint. */
function paintMonth(
  canvas: HTMLCanvasElement,
  cells: GridCell[],
  densities: number[],
  edges: boolean[],
  todayIndex: number,
  color: PixelColor,
  matrix: number[][],
  cssWidth: number,
  cssHeight: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || cssWidth <= 0 || cssHeight <= 0) return;
  const cols = Math.max(7, Math.round(cssWidth / CELL));
  const rows = Math.max(6, Math.round(cssHeight / CELL));
  canvas.width = cols;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, cols, rows);
  const colW = cols / 7;
  const rowH = rows / 6;
  for (let i = 0; i < 42; i++) {
    const density = densities[i];
    if (density <= 0) continue;
    const cell = cells[i];
    const cx = Math.floor((cell.index % 7) * colW);
    const cy = Math.floor(Math.floor(cell.index / 7) * rowH);
    const cw = Math.floor(((cell.index % 7) + 1) * colW) - cx;
    const ch = Math.floor((Math.floor(cell.index / 7) + 1) * rowH) - cy;
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const gx = cx + px;
        const gy = cy + py;
        const lit = density > matrix[gy & 3][gx & 3];
        const alpha = lit ? 0.32 + 0.6 * density : 0.08 * density;
        if (alpha <= 0.004) continue;
        ctx.fillStyle = rgb(fill, 1, alpha);
        ctx.fillRect(gx, gy, 1, 1);
      }
    }
  }
  // Today ring (muted) and selected-edge ring (fill colour) drawn as cell
  // outlines so the highlight reads as a pixel frame, not a CSS border.
  if (todayIndex >= 0) strokeCell(ctx, todayIndex, colW, rowH, fill, 0.55);
  for (let i = 0; i < 42; i++) {
    if (edges[i]) strokeCell(ctx, i, colW, rowH, fill, 0.9);
  }
}

function strokeCell(
  ctx: CanvasRenderingContext2D,
  index: number,
  colW: number,
  rowH: number,
  fill: [number, number, number],
  alpha: number,
): void {
  const col = index % 7;
  const row = Math.floor(index / 7);
  const x = Math.round(col * colW);
  const y = Math.round(row * rowH);
  const w = Math.round((col + 1) * colW) - x;
  const h = Math.round((row + 1) * rowH) - y;
  ctx.fillStyle = rgb(fill, 1, alpha);
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/**
 * DitherDatePicker — a month-grid calendar whose states are expressed in the
 * kit's ordered-dither language: today reads as a mid Bayer wash + pixel ring,
 * selection as a dense fill + frame, and a range's in-band days as a quiet
 * mid wash that visually connects the two edges.
 *
 * Controlled via `value`/`onChange`. `mode="single"` selects one date;
 * `mode="range"` selects an inclusive `[start, end]` pair — the first click
 * sets the start, the second the end (auto-ordered), and a third restarts.
 *
 * Accessibility: a WAI-ARIA `role="grid"` (6 week rows × 7 day columns) with
 * roving-tabindex day cells. Full keyboard control — Arrow keys move a day (or
 * a week vertically), Home/End jump to the row's Sunday/Saturday, PageUp/Down
 * change the month (Shift = year), Enter/Space select the focused day, and
 * crossing a month boundary while navigating moves the view with the focus.
 *
 * SSR-safe: the visible month is derived from `value`/`defaultMonth` (never
 * `new Date()` at init), so server and client render identically; the today
 * marker resolves client-side after mount. Ids come from `useId()`.
 */
export function DitherDatePicker({
  mode = "single",
  value,
  onChange,
  weekStartsOn = 0,
  defaultMonth,
  min,
  max,
  color: colorProp,
  seed,
  className,
  weekdayLabels,
}: DitherDatePickerProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const isRange = mode === "range";
  const single: DateISO | null = !isRange ? (value as DateSingleValue) ?? null : null;
  const range: DateRangeValue = isRange
    ? (value as DateRangeValue) ?? { start: null, end: null }
    : { start: null, end: null };

  // Initial view month: explicit default → value's month → today (client-only
  // resolve so the server render is deterministic).
  const [view, setView] = useState(() => {
    if (defaultMonth) return { year: defaultMonth.year, month: defaultMonth.month };
    const fromSingle = fromISO(single);
    if (fromSingle) return { year: fromSingle.y, month: fromSingle.m };
    const fromStart = fromISO(range.start);
    if (fromStart) return { year: fromStart.y, month: fromStart.m };
    return { year: 2000, month: 0 };
  });
  // Snap to today on mount only when nothing pinned the view (client-only).
  const [today, setToday] = useState<DateISO | null>(null);
  const [hovered, setHovered] = useState<DateISO | null>(null);
  // iso of the day to keep focused (drives roving tabindex + ref focus).
  const [focusIso, setFocusIso] = useState<DateISO | null>(() => {
    const v = fromISO(single) ?? fromISO(range.start);
    return v ? toISO(v.y, v.m, v.d) : null;
  });

  const grid = useMemo(
    () => buildGrid(view.year, view.month, weekStartsOn),
    [view, weekStartsOn],
  );

  const weekdays = useMemo(() => {
    const base = weekdayLabels && weekdayLabels.length === 7 ? weekdayLabels : WEEKDAY;
    return Array.from({ length: 7 }, (_, i) => base[(i + weekStartsOn) % 7]);
  }, [weekdayLabels, weekStartsOn]);

  const cellByIso = useMemo(() => {
    const m = new Map<DateISO, GridCell>();
    for (const c of grid) m.set(c.iso, c);
    return m;
  }, [grid]);

  // If no focus pinned yet, focus the 1st (or today once known).
  useEffect(() => {
    if (focusIso) return;
    const t = today && cellByIso.has(today) ? today : grid.find((c) => c.inMonth)?.iso ?? null;
    if (t) setFocusIso(t);
  }, [focusIso, today, cellByIso, grid]);

  useEffect(() => {
    const n = new Date();
    setToday(toISO(n.getFullYear(), n.getMonth(), n.getDate()));
  }, []);

  const densities = useMemo(
    () => grid.map((c) => cellDensity(c, mode, single, range, today, hovered)),
    [grid, mode, single, range, today, hovered],
  );
  const edges = useMemo(
    () =>
      grid.map((c) => {
        if (mode === "single") return c.iso === single;
        const lo = range.start && range.end && cmp(range.start, range.end) > 0 ? range.end : range.start;
        const hi = range.start && range.end && cmp(range.start, range.end) > 0 ? range.start : range.end;
        return c.iso === lo || c.iso === hi;
      }),
    [grid, mode, single, range],
  );
  const todayIndex = useMemo(() => {
    const i = today ? grid.findIndex((c) => c.iso === today) : -1;
    return i >= 0 && grid[i]?.inMonth ? i : -1;
  }, [grid, today]);

  const isDisabled = useCallback(
    (iso: DateISO): boolean => (min && cmp(iso, min) < 0) || (max && cmp(iso, max) > 0) ? true : false,
    [min, max],
  );

  // Canvas paint + resize. Repaint whenever any density/edge input moves.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root || !canvas) return;
      const r = root.getBoundingClientRect();
      paintMonth(
        canvas,
        grid,
        densities,
        edges,
        todayIndex,
        color,
        matrix,
        r.width,
        r.height,
      );
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && rootRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(rootRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [grid, densities, edges, todayIndex, color, matrix]);

  // Roving-tabindex focus management: refocus the pinned day after any
  // view/grid change (queueMicrotask lets the new buttons commit first).
  const cellRefs = useRef<Map<DateISO, HTMLButtonElement>>(new Map());
  useEffect(() => {
    if (!focusIso) return;
    queueMicrotask(() => cellRefs.current.get(focusIso)?.focus());
  }, [focusIso, grid]);

  const goPrevMonth = useCallback(() => {
    setView((v) => {
      const m = v.month - 1;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }, []);
  const goNextMonth = useCallback(() => {
    setView((v) => {
      const m = v.month + 1;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }, []);
  const goToday = useCallback(() => {
    const n = new Date();
    const y = n.getFullYear();
    const m = n.getMonth();
    setView({ year: y, month: m });
    setFocusIso(toISO(y, m, n.getDate()));
  }, []);

  // Move focus by a day delta; if the target lands in another month, move the
  // view so the grid rebuilds around it, then the effect above refocuses.
  const moveByDays = useCallback(
    (delta: number) => {
      const cur = focusIso ?? grid[0].iso;
      const c = fromISO(cur);
      if (!c) return;
      const d = new Date(c.y, c.m, c.d + delta);
      const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
      if (d.getMonth() !== view.month || d.getFullYear() !== view.year) {
        setView({ year: d.getFullYear(), month: d.getMonth() });
      }
      setFocusIso(iso);
    },
    [focusIso, grid, view],
  );

  const moveMonth = useCallback(
    (step: number) => {
      const cur = focusIso ?? grid[0].iso;
      const c = fromISO(cur);
      if (!c) return;
      const nm = c.m + step;
      const y = c.y + Math.floor(nm / 12);
      const m = ((nm % 12) + 12) % 12;
      const day = Math.min(c.d, daysInMonth(y, m));
      setView({ year: y, month: m });
      setFocusIso(toISO(y, m, day));
    },
    [focusIso, grid],
  );

  // Select the focused/clicked day. A useCallback (not a plain declaration) so
  // the keyboard handler always reads the current range/selection state — a
  // plain function captured by the memoized onCellKeydown would go stale on the
  // second Enter in range mode.
  const select = useCallback(
    (iso: DateISO) => {
      if (isDisabled(iso)) return;
      if (!isRange) {
        onChange?.(iso);
        return;
      }
      const start = range.start;
      const end = range.end;
      if (!start || (start && end)) {
        onChange?.({ start: iso, end: null });
        return;
      }
      const ordered = cmp(start, iso) <= 0 ? { start, end: iso } : { start: iso, end: start };
      onChange?.(ordered);
    },
    [isRange, range, onChange, isDisabled],
  );

  const onCellKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      const cur = focusIso ?? grid[0].iso;
      const c = fromISO(cur);
      if (!c) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveByDays(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveByDays(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveByDays(-7);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveByDays(7);
          break;
        case "Home": {
          e.preventDefault();
          const d = new Date(c.y, c.m, c.d);
          const back = (d.getDay() - weekStartsOn + 7) % 7;
          moveByDays(-back);
          break;
        }
        case "End": {
          e.preventDefault();
          const d = new Date(c.y, c.m, c.d);
          const fwd = (weekStartsOn + 6 - d.getDay()) % 7;
          moveByDays(fwd);
          break;
        }
        case "PageUp":
          e.preventDefault();
          moveMonth(e.shiftKey ? -12 : -1);
          break;
        case "PageDown":
          e.preventDefault();
          moveMonth(e.shiftKey ? 12 : 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          select(cur);
          break;
        default:
          break;
      }
    },
    [focusIso, grid, weekStartsOn, moveByDays, moveMonth, select],
  );


  const monthLabel = `${MONTH_NAMES[view.month]} ${view.year}`;

  const reactId = useId();
  const labelId = `${reactId}-label`;

  const describedRange = isRange
    ? range.start && range.end
      ? `${range.start} to ${range.end}`
      : range.start
        ? `from ${range.start}`
        : "no dates"
    : single
      ? single
      : "no date";

  return (
    <div className={cn("w-[19rem] font-mono text-foreground", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
          onClick={goPrevMonth}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span id={labelId} className="text-[12px] tabular-nums" aria-live="polite">
            {monthLabel}
          </span>
        </div>
        <button
          type="button"
          aria-label="Next month"
          className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
          onClick={goNextMonth}
        >
          ›
        </button>
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        aria-label={`Calendar, ${describedRange}`}
      >
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground" aria-hidden="true">
          {weekdays.map((w) => (
            <span key={w}>{w[0]}</span>
          ))}
        </div>

        <div
          ref={rootRef}
          className="relative grid grid-cols-7 grid-rows-6 gap-0.5"
          style={{ aspectRatio: "7 / 6" }}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -m-0.5"
            style={{ imageRendering: "pixelated" }}
          />
          <div
            role="grid"
            aria-rowcount={6}
            aria-colcount={7}
            aria-multiselectable={isRange || undefined}
            className="absolute inset-0 grid grid-cols-7 grid-rows-6 gap-0.5"
          >
            {Array.from({ length: 6 }, (_, row) => (
              <div role="row" aria-rowindex={row + 1} key={`r-${row}`} className="contents">
                {grid.slice(row * 7, row * 7 + 7).map((cell) => {
                  const dense = densities[cell.index];
                  const selected = edges[cell.index];
                  const disabled = isDisabled(cell.iso);
                  const focused = focusIso === cell.iso;
                  return (
                    <button
                      key={cell.iso}
                      ref={(el) => {
                        if (el) cellRefs.current.set(cell.iso, el);
                        else cellRefs.current.delete(cell.iso);
                      }}
                      type="button"
                      role="gridcell"
                      tabIndex={focused ? 0 : -1}
                      aria-selected={selected || undefined}
                      aria-disabled={disabled || undefined}
                      aria-label={`${cell.day} ${cell.iso}${cell.iso === today ? ", today" : ""}`}
                      disabled={disabled}
                      onFocus={() => setFocusIso(cell.iso)}
                      onMouseEnter={() => setHovered(cell.iso)}
                      onMouseLeave={() => setHovered((h) => (h === cell.iso ? null : h))}
                      onClick={() => select(cell.iso)}
                      onKeyDown={onCellKeydown}
                      className={cn(
                        "relative flex items-center justify-center rounded-[2px] text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground",
                        cell.inMonth ? "text-foreground" : "text-muted-foreground/40",
                        disabled && "cursor-not-allowed opacity-40",
                        dense >= 0.95 && "font-bold",
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goToday}
          className="rounded border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
        >
          Today
        </button>
        <span className="text-[10px] text-muted-foreground tabular-nums">{describedRange}</span>
      </div>
    </div>
  );
}
