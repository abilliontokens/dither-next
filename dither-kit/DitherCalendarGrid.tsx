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
import { CONTROL_BUTTON } from "./control";
import { useCanvasVisibility } from "./use-visibility";
import { cn } from "./lib";

const CELL = 2; // css px per backing dither px
const GAP_CSS = 4;
const GAP_BACK = GAP_CSS / CELL;
const ROWS = 6; // fixed week-row count keeps the grid box stable month to month

export type DitherCalendarEvent = {
  /** Day the event lands on, `yyyy-mm-dd` (UTC, like the kit's other calendars). */
  date: string;
  label: string;
  /** Per-event accent; falls back to the grid `color`. */
  color?: PixelColor;
};

export interface DitherCalendarGridProps {
  /** The month to display (any day in it). Controlled: pass it to drive the view. */
  month?: Date;
  /** Initial month when uncontrolled. Deterministic — pass a fixed Date to avoid the
   *  one-frame "current month" resolve that happens otherwise (see SSR note below). */
  defaultMonth?: Date;
  /** Fired on every month navigation (prev/next/today/PageUp/PageDown). */
  onMonthChange?: (month: Date) => void;
  /** Controlled set of selected days. */
  selected?: Date[];
  /** Events whose per-day count drives each cell's dither density. */
  events?: DitherCalendarEvent[];
  /** 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** CSS size of a day cell (kept even so the backing grid is integral). Default 44. */
  cellSize?: number;
  /** Accessible label prefix. Default "Calendar". */
  label?: string;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Fired when a day is activated (click or Enter/Space). `yyyy-mm-dd`. */
  onSelectDay?: (iso: string) => void;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Stable fallback month so server + first client render agree — `new Date()` is
 *  never called in render (HARD RULE); the real "current month" resolves in an
 *  effect for the uncontrolled, no-`defaultMonth` case. */
const EPOCH_MONTH = new Date(Date.UTC(2024, 0, 1));

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type DayCell = { iso: string; date: Date; inMonth: boolean };

/** Build a fixed 6×7 grid of days around the first of `viewMonth`, leading/trailing
 *  days drawn from the adjacent months. Pure + deterministic (integer Date math). */
function monthGrid(viewMonth: Date, weekStartsOn: 0 | 1): DayCell[][] {
  const year = viewMonth.getUTCFullYear();
  const month = viewMonth.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  let leading = first.getUTCDay() - weekStartsOn;
  if (leading < 0) leading += 7;
  const cursor = new Date(Date.UTC(year, month, 1 - leading));
  const weeks: DayCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: DayCell[] = [];
    for (let c = 0; c < 7; c++) {
      row.push({
        iso: toISO(cursor),
        date: new Date(cursor),
        inMonth: cursor.getUTCMonth() === month,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/** Paint the whole day field in one pass. Each day is a dither rect whose density
 *  = its event count over the month max, so an empty day reads as a faint wash and
 *  a peak day reads near-solid — the kit's ordered-dither identity, never opacity. */
function paintCalendar(
  canvas: HTMLCanvasElement,
  weeks: DayCell[][],
  counts: Map<string, number>,
  maxCount: number,
  color: PixelColor,
  matrix: number[][],
  dayBack: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const stepBack = dayBack + GAP_BACK;
  const w = 7 * dayBack + 6 * GAP_BACK;
  const h = ROWS * dayBack + (ROWS - 1) * GAP_BACK;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, w, h);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = weeks[r][c];
      const count = counts.get(cell.iso) ?? 0;
      let density = count > 0 ? count / maxCount : 0;
      if (!cell.inMonth) density *= 0.4; // adjacent-month days recede
      const x0 = c * stepBack;
      const y0 = r * stepBack;
      for (let py = 0; py < dayBack; py++) {
        for (let px = 0; px < dayBack; px++) {
          const lit = density > matrix[(y0 + py) & 3][(x0 + px) & 3];
          // 0 events still gets a faint floor so the calendar reads as a grid.
          const alpha = lit ? 0.28 + 0.6 * density : 0.05 + 0.05 * density;
          if (alpha <= 0.004) continue;
          ctx.fillStyle = rgb(fill, 1, alpha);
          ctx.fillRect(x0 + px, y0 + py, 1, 1);
        }
      }
    }
  }
}

/**
 * DitherCalendarGrid — a full-month scheduling/heatmap calendar (NOT a date
 * picker). Each day cell carries a Bayer-dithered intensity fill encoding that
 * day's event density: 0 events = faint wash, peak day = near-solid. The dither
 * is painted on one backing canvas behind a transparent, focusable button grid.
 *
 * Controlled or uncontrolled month: pass `month` (+ `onMonthChange`) to drive
 * it, or leave it off and navigate with the header buttons / PageUp·PageDown.
 * `selected` (Date[]) and `events` ({date,label,color?}[]) are always controlled.
 *
 * Accessibility: a WAI-ARIA `role="grid"` — one weekday header row of
 * `columnheader`s, then 6 week `row`s of `gridcell`s. Day cells use roving
 * tabindex; Arrow keys move day-to-day (wrapping across week boundaries),
 * Home/End jump to the week ends, PageUp/PageDown change the month, Enter/Space
 * fire `onSelectDay`.
 *
 * SSR / hydration: no `new Date()` in render. The view month is fully derived
 * from `month`/`defaultMonth` (deterministic integer Date math); only the
 * "current month" default and the today highlight resolve in `useEffect`, with a
 * stable epoch fallback so server and first-client renders agree. Canvas pixels
 * never hydrate, and every coordinate reaching an inline style is an integer.
 */
export function DitherCalendarGrid({
  month,
  defaultMonth,
  onMonthChange,
  selected,
  events,
  weekStartsOn = 0,
  cellSize = 44,
  label = "Calendar",
  color: colorProp,
  seed,
  className,
  onSelectDay,
}: DitherCalendarGridProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const dayBack = Math.max(8, Math.round(cellSize / CELL));
  const dayCss = dayBack * CELL; // integral css size actually rendered
  const gridCssW = 7 * dayCss + 6 * GAP_CSS;
  const gridCssH = ROWS * dayCss + (ROWS - 1) * GAP_CSS;

  // --- view month: controlled, defaultMonth, or epoch → effect-set "today" ----
  const [internalMonth, setInternalMonth] = useState<Date | null>(
    defaultMonth ? new Date(Date.UTC(defaultMonth.getUTCFullYear(), defaultMonth.getUTCMonth(), 1)) : null,
  );
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    if (defaultMonth === undefined && month === undefined && internalMonth === null) {
      const n = new Date();
      setInternalMonth(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)));
    }
    setToday(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
  // mount-only: establish the uncontrolled default + today without firing onChange
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewMonth = useMemo(() => {
    const src = month ?? internalMonth ?? EPOCH_MONTH;
    return new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), 1));
  }, [month, internalMonth]);

  const goMonth = useCallback(
    (delta: number) => {
      const m = new Date(Date.UTC(viewMonth.getUTCFullYear(), viewMonth.getUTCMonth() + delta, 1));
      if (month === undefined) setInternalMonth(m);
      onMonthChange?.(m);
    },
    [viewMonth, month, onMonthChange],
  );

  // --- data -----------------------------------------------------------------
  const weeks = useMemo(() => monthGrid(viewMonth, weekStartsOn), [viewMonth, weekStartsOn]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const ev of events ?? []) m.set(ev.date, (m.get(ev.date) ?? 0) + 1);
    return m;
  }, [events]);
  const maxCount = useMemo(() => {
    let mx = 1;
    counts.forEach((v) => { if (v > mx) mx = v; });
    return mx;
  }, [counts]);

  const selectedSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of selected ?? []) set.add(toISO(d));
    return set;
  }, [selected]);

  const todayIso = today ? toISO(today) : null;

  // --- dither canvas (static paint; repainted on data/colour/resize/visibility)
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);
  const visible = useCanvasVisibility(wrapRef, () => setTick((t) => t + 1));
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      if (canvasRef.current) paintCalendar(canvasRef.current, weeks, counts, maxCount, color, matrix, dayBack);
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(wrapRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [weeks, counts, maxCount, color, matrix, dayBack, visible, tick]);

  // --- roving tabindex over the day grid ------------------------------------
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const key = (r: number, c: number) => `${r}-${c}`;

  const focusCell = useCallback((r: number, c: number) => {
    setFocus({ r, c });
    queueMicrotask(() => cellRefs.current.get(key(r, c))?.focus());
  }, []);

  const onCellKeydown = useCallback(
    (r: number, c: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      let nr = r;
      let nc = c;
      let moved = false;
      switch (e.key) {
        case "ArrowRight": nc = Math.min(6, c + 1); moved = nc !== c; break;
        case "ArrowLeft": nc = Math.max(0, c - 1); moved = nc !== c; break;
        case "ArrowDown": nr = Math.min(ROWS - 1, r + 1); moved = nr !== r; break;
        case "ArrowUp": nr = Math.max(0, r - 1); moved = nr !== r; break;
        case "Home": nc = 0; moved = true; break;
        case "End": nc = 6; moved = true; break;
        case "PageUp": e.preventDefault(); goMonth(-1); return;
        case "PageDown": e.preventDefault(); goMonth(1); return;
        default: return;
      }
      if (!moved) return;
      e.preventDefault();
      focusCell(nr, nc);
    },
    [focusCell, goMonth],
  );

  const reactId = useId();
  const descId = `${reactId}-desc`;

  const headerOrder = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) out.push(WEEKDAY[(i + weekStartsOn) % 7]);
    return out;
  }, [weekStartsOn]);

  const monthLabel = `${MONTH[viewMonth.getUTCMonth()]} ${viewMonth.getUTCFullYear()}`;

  return (
    <div className={cn("font-mono text-foreground", className)}>
      {/* Header: prev / month·year / next, plus a Today jump. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => goMonth(-1)}
            className={cn("rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[12px] hover:border-foreground/30", CONTROL_BUTTON)}
          >
            ‹
          </button>
          <span className="min-w-[7.5rem] text-center text-[13px] tabular-nums" aria-live="polite">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => goMonth(1)}
            className={cn("rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[12px] hover:border-foreground/30", CONTROL_BUTTON)}
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (month === undefined) setInternalMonth(new Date(Date.UTC(today ? today.getUTCFullYear() : new Date().getUTCFullYear(), today ? today.getUTCMonth() : new Date().getUTCMonth(), 1)));
            onMonthChange?.(new Date(Date.UTC(today ? today.getUTCFullYear() : new Date().getUTCFullYear(), today ? today.getUTCMonth() : new Date().getUTCMonth(), 1)));
          }}
          className={cn("rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground", CONTROL_BUTTON)}
        >
          Today
        </button>
      </div>

      <div
        role="grid"
        aria-label={label}
        aria-rowcount={ROWS + 1}
        aria-colcount={7}
        aria-describedby={descId}
        className="inline-block"
      >
        {/* Weekday header row. */}
        <div role="row" aria-rowindex={1} className="grid mb-1" style={{ gridTemplateColumns: `repeat(7, ${dayCss}px)`, columnGap: `${GAP_CSS}px` }}>
          {headerOrder.map((wd) => (
            <div role="columnheader" key={wd} className="text-center text-[10px] text-muted-foreground" style={{ height: 18, lineHeight: "18px" }}>
              {wd}
            </div>
          ))}
        </div>

        {/* Day field: one dither canvas + a transparent focusable grid overlay. */}
        <div ref={wrapRef} className="relative" style={{ width: gridCssW, height: gridCssH }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0"
            style={{ width: gridCssW, height: gridCssH, imageRendering: "pixelated" }}
          />
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(7, ${dayCss}px)`, gridTemplateRows: `repeat(${ROWS}, ${dayCss}px)`, columnGap: `${GAP_CSS}px`, rowGap: `${GAP_CSS}px` }}
          >
            {weeks.map((row, r) => (
              <div role="row" aria-rowindex={r + 2} key={`row-${r}`} className="contents">
                {row.map((cell, c) => {
                  const isSel = selectedSet.has(cell.iso);
                  const isToday = todayIso === cell.iso;
                  const isFocused = focus.r === r && focus.c === c;
                  const count = counts.get(cell.iso) ?? 0;
                  return (
                    <button
                      key={cell.iso}
                      ref={(el) => { if (el) cellRefs.current.set(key(r, c), el); else cellRefs.current.delete(key(r, c)); }}
                      role="gridcell"
                      tabIndex={isFocused ? 0 : -1}
                      aria-colindex={c + 1}
                      aria-selected={isSel || undefined}
                      aria-label={`${cell.iso}${count > 0 ? `, ${count} ${count === 1 ? "event" : "events"}` : ", no events"}${isToday ? ", today" : ""}`}
                      onFocus={() => setFocus({ r, c })}
                      onClick={() => onSelectDay?.(cell.iso)}
                      onKeyDown={onCellKeydown(r, c)}
                      className={cn(
                        "relative flex flex-col items-start rounded-[2px] p-1 text-left align-top outline-none transition-shadow",
                        "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground",
                        cell.inMonth ? "text-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      <span className={cn("text-[11px] leading-none tabular-nums", isToday && "font-bold")}>{cell.date.getUTCDate()}</span>
                      {count > 0 && (
                        <span aria-hidden="true" className="mt-auto flex gap-[2px]">
                          {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                            <span key={i} className="block h-[3px] w-[3px] rounded-[1px] bg-foreground/70" />
                          ))}
                        </span>
                      )}
                      {(isSel || isToday) && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute inset-0 rounded-[2px] ring-1",
                            isSel ? "ring-accent" : "ring-foreground/50",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <span id={descId} className="sr-only">{`${label}: ${monthLabel}. Arrow keys move between days, PageUp and PageDown change the month.`}</span>
    </div>
  );
}
