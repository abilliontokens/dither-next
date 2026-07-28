"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
/** Fixed row height so the dither stripe tile aligns one-per-row. */
const ROW_CSS = 36;
const ROW_BACK = Math.round(ROW_CSS / CELL);
/** Stripe tile width — a couple of Bayer cycles, tiled across the row. */
const STRIPE_TILE_BACK = 8;

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

export interface TableColumn<T> {
  /** Stable id; also the sort/filter key. */
  key: string;
  label: ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  /** Value used for sorting + filtering (defaults to `row[key]`). */
  accessor?: (row: T) => string | number;
  /** Custom cell renderer (defaults to the accessor/`row[key]` value). */
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DitherDataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  /** Stable per-row id (required for keyed rendering). */
  getRowKey: (row: T) => string;
  /** Globally enable sortable headers (default: per-column `sortable`). */
  sortable?: boolean;
  /** Globally enable per-column filter inputs (default: per-column `filterable`). */
  filterable?: boolean;
  /** Controlled sort state. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Empty-state body. */
  placeholder?: ReactNode;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/** Paint a single Bayer stripe tile (full row height, a few cells wide) and
 *  return its data URL. Applied as a repeating background on even rows so the
 *  table reads with the kit's ordered-dither banding instead of a flat tint. */
function paintStripeTile(color: PixelColor, matrix: number[][]): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = STRIPE_TILE_BACK;
  canvas.height = ROW_BACK;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, STRIPE_TILE_BACK, ROW_BACK);
  for (let y = 0; y < ROW_BACK; y++) {
    for (let x = 0; x < STRIPE_TILE_BACK; x++) {
      const lit = 0.28 > matrix[y & 3][x & 3];
      const alpha = lit ? 0.16 : 0.05;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

function cellText<T>(row: T, col: TableColumn<T>): string {
  const raw =
    col.accessor !== undefined
      ? col.accessor(row)
      : ((row as Record<string, unknown>)[col.key] ?? "");
  return String(raw);
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * DitherDataTable — a sortable, optionally filterable table whose even rows
 * carry a faint ordered-dither band (a tiled Bayer wash in the fill colour) so
 * the grid reads as the kit's texture rather than flat zebra stripes.
 *
 * Generic over the row type `T`. Sort is controlled: pass `sort` (a
 * `{ key, dir }` pair or `null`) and receive changes via `onSortChange`.
 * Clicking a sortable header cycles `none → asc → desc → none`. Per-column
 * text filters are uncontrolled inputs (their value lives here); a row passes
 * when every filterable column's cell value contains that column's query
 * (case-insensitive).
 *
 * Accessibility: a WAI-ARIA `role="table"` with `role="row"`/`columnheader`/
 * `cell`. Sortable headers are buttons carrying `aria-sort` (`ascending`,
 * `descending`, or `none`); rows are focusable (`tabindex="0"`). The sticky
 * header stays pinned within the scroll body.
 *
 * SSR-safe: the stripe tile is painted in an effect (canvas only in the
 * browser); ids from `useId()`.
 */
export function DitherDataTable<T>({
  columns,
  rows,
  getRowKey,
  sortable = false,
  filterable = false,
  sort,
  onSortChange,
  placeholder,
  color: colorProp,
  seed,
  className,
}: DitherDataTableProps<T>) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color = useMemo<PixelColor>(() => colorProp ?? s?.hue ?? "blue", [colorProp, s]);
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );
  const [stripe, setStripe] = useState<string | null>(null);

  // Paint the stripe tile once the colour/matrix settle.
  useEffect(() => {
    setStripe(paintStripeTile(color, matrix));
  }, [color, matrix]);

  const [filters, setFilters] = useState<Record<string, string>>({});

  const sortAccessorFor = useCallback(
    (key: string): ((row: T) => string | number) | undefined => {
      const col = columns.find((c) => c.key === key);
      if (!col) return undefined;
      return col.accessor ?? ((row: T) => cellText(row, col));
    },
    [columns],
  );

  const filteredRows = useMemo(() => {
    const active = columns.filter((c) => (filterable || c.filterable) && filters[c.key]);
    if (active.length === 0) return rows;
    return rows.filter((row) =>
      active.every((col) => {
        const q = filters[col.key].toLowerCase();
        return cellText(row, col).toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, filters, filterable]);

  const displayRows = useMemo(() => {
    if (!sort) return filteredRows;
    const acc = sortAccessorFor(sort.key);
    if (!acc) return filteredRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => compareValues(acc(a), acc(b)) * dir);
  }, [filteredRows, sort, sortAccessorFor]);

  const reactId = useId();

  function cycleSort(key: string): void {
    const next: SortState =
      sort?.key === key
        ? sort.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" };
    onSortChange?.(next);
  }

  const stripeBg = useMemo(
    () =>
      stripe
        ? {
            backgroundImage: `url(${stripe})`,
            backgroundSize: `${STRIPE_TILE_BACK * CELL}px ${ROW_CSS}px`,
            backgroundRepeat: "repeat",
          }
        : undefined,
    [stripe],
  );

  const ariaSortFor = (key: string): "ascending" | "descending" | "none" => {
    if (sort?.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  };

  const alignClass = (a: TableColumn<T>["align"]): string =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div
      role="table"
      aria-rowcount={displayRows.length + 1}
      aria-colcount={columns.length}
      aria-describedby={`${reactId}-desc`}
      className={cn(
        "overflow-auto rounded-md border border-border/60 font-mono text-[12px] text-foreground",
        className,
      )}
    >
      <div role="rowgroup" className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
        <div role="row" className="grid border-b border-border/60" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(7rem, 1fr))` }}>
          {columns.map((col) => {
            const canSort = sortable || col.sortable;
            const canFilter = filterable || col.filterable;
            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={canSort ? ariaSortFor(col.key) : undefined}
                className="flex flex-col gap-1 px-2 py-1.5"
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => cycleSort(col.key)}
                    className={cn(
                      "flex items-center gap-1 self-start text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                      alignClass(col.align),
                      sort?.key === col.key && "text-foreground",
                    )}
                  >
                    <span>{col.label}</span>
                    <span aria-hidden="true" className="text-[10px]">
                      {sort?.key === col.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  <span className={cn("text-muted-foreground", alignClass(col.align))}>{col.label}</span>
                )}
                {canFilter ? (
                  <input
                    type="text"
                    value={filters[col.key] ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                    }
                    placeholder="filter"
                    aria-label={`Filter ${typeof col.label === "string" ? col.label : col.key}`}
                    className="w-full rounded border border-border/50 bg-background/60 px-1 py-0.5 text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-accent/70 focus-visible:ring-1 focus-visible:ring-accent/20"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div role="rowgroup">
        {displayRows.length === 0 ? (
          <div className="flex min-h-16 items-center justify-center px-3 py-4 text-[12px] text-muted-foreground">
            {placeholder ?? "No rows"}
          </div>
        ) : (
          displayRows.map((row, ri) => (
            <div
              key={getRowKey(row)}
              role="row"
              tabIndex={0}
              aria-rowindex={ri + 2}
              className={cn(
                "grid border-b border-border/30 outline-none transition-colors last:border-b-0 focus-visible:bg-background/60 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/40",
                ri % 2 === 1 ? "bg-background/30" : "",
              )}
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(7rem, 1fr))`,
                ...(ri % 2 === 1 ? stripeBg : undefined),
              }}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  role="cell"
                  className={cn("truncate px-2 py-1.5", alignClass(col.align), col.className)}
                >
                  {col.render ? col.render(row) : cellText(row, col)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <span id={`${reactId}-desc`} className="sr-only">
        {`Table with ${columns.length} columns and ${displayRows.length} rows.`}
      </span>
    </div>
  );
}
