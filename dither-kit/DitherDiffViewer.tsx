"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
const BAYER_PERIOD = 4;

// --- pure LCS line/word diff (zero deps) -----------------------------------

type DiffOp =
  | { type: "equal"; a: string; b: string }
  | { type: "remove"; a: string }
  | { type: "add"; b: string };

/** Classic O(n·m) LCS dynamic program → a minimal edit script. The full
 *  product table is built, which is fine for interactive text diffs (the
 *  component's target); multi-thousand-line inputs are not. Pure functions
 *  only — reused for both line-level and word-level diffs. */
function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  // dp[i][j] = length of the LCS of a[i..] and b[j..]
  const dp: number[][] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Array<number>(m + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i];
    const next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        a[i] === b[j]
          ? next[j + 1] + 1
          : Math.max(next[j], row[j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", a: a[i], b: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", a: a[i] });
      i++;
    } else {
      ops.push({ type: "add", b: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", a: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "add", b: b[j] });
    j++;
  }
  return ops;
}

/** Split into whitespace runs and word runs, preserving order so the source
 *  reconstructs exactly. */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

type Segment = { text: string; changed: boolean };

/** Word-level diff of `text` against `other`: tokens present in `text` but not
 *  in `other` are flagged changed — the standard intra-line highlight. */
function wordSegments(text: string, other: string): Segment[] {
  const ops = lcsDiff(tokenize(other), tokenize(text));
  const out: Segment[] = [];
  for (const op of ops) {
    if (op.type === "equal") out.push({ text: op.b, changed: false });
    else if (op.type === "add") out.push({ text: op.b, changed: true });
    // `remove` = token in `other` only → not part of this line, skip.
  }
  return out;
}

// --- diff → rows → collapsible hunks ---------------------------------------

type LineRow = {
  type: "equal" | "add" | "remove";
  beforeNo: number | null;
  afterNo: number | null;
  text: string;
  /** Adjacent opposite line, for word-level cross-highlight. */
  partner: string | null;
};

function toRows(ops: DiffOp[]): LineRow[] {
  const rows: LineRow[] = [];
  let bn = 1;
  let an = 1;
  for (const op of ops) {
    if (op.type === "equal") {
      rows.push({ type: "equal", beforeNo: bn, afterNo: an, text: op.a, partner: null });
      bn++;
      an++;
    } else if (op.type === "remove") {
      rows.push({ type: "remove", beforeNo: bn, afterNo: null, text: op.a, partner: null });
      bn++;
    } else {
      rows.push({ type: "add", beforeNo: null, afterNo: an, text: op.b, partner: null });
      an++;
    }
  }
  // Pair adjacent remove→add runs so word-diff can cross-highlight them.
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].type === "remove" && rows[k + 1]?.type === "add") {
      rows[k].partner = rows[k + 1].text;
      rows[k + 1].partner = rows[k].text;
    }
  }
  return rows;
}

type SegmentKind =
  | { kind: "lines"; start: number; end: number }
  | { kind: "gap"; count: number; start: number };

/** Group rows into visible line-runs and collapsible unchanged gaps. A row is
 *  visible if it is changed, within `context` lines of a change, or its gap
 *  start is in `expanded` (the user unfolded it). */
function buildSegments(
  rows: LineRow[],
  context: number,
  expanded: Set<number>,
): SegmentKind[] {
  const n = rows.length;
  const hasChange = rows.some((r) => r.type !== "equal");
  const within = new Array<boolean>(n).fill(false);
  if (hasChange) {
    for (let k = 0; k < n; k++) {
      if (rows[k].type !== "equal") {
        for (let d = -context; d <= context; d++) {
          const x = k + d;
          if (x >= 0 && x < n) within[x] = true;
        }
      }
    }
  } else {
    within.fill(true);
  }
  const segs: SegmentKind[] = [];
  let i = 0;
  while (i < n) {
    if (within[i] || expanded.has(i)) {
      const s = i;
      while (i < n && (within[i] || expanded.has(i))) i++;
      segs.push({ kind: "lines", start: s, end: i });
    } else {
      const s = i;
      let c = 0;
      while (i < n && !within[i] && !expanded.has(i)) {
        c++;
        i++;
      }
      segs.push({ kind: "gap", count: c, start: s });
    }
  }
  return segs;
}

// --- Bayer tint band behind add/remove lines -------------------------------

/** Paint a seamless Bayer tint tile (one 4-px period wide) at the given
 *  density/lightness. Tiled vertically behind changed lines, density is the
 *  encoder for add vs remove (denser = added), with a secondary lightness cue.
 *  Returns a data URL or null off-DOM. */
function paintBandTile(
  density: number,
  dim: number,
  color: PixelColor,
  matrix: number[][],
  lineH: number,
): string | null {
  if (typeof document === "undefined" || lineH <= 0) return null;
  const colsB = BAYER_PERIOD;
  const rowsB = Math.max(2, Math.round(lineH / CELL));
  const canvas = document.createElement("canvas");
  canvas.width = colsB;
  canvas.height = rowsB;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, colsB, rowsB);
  for (let y = 0; y < rowsB; y++) {
    for (let x = 0; x < colsB; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const alpha = lit ? 0.5 + 0.45 * density : 0.08 * density;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, dim, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

// --- component -------------------------------------------------------------

export interface DitherDiffViewerProps {
  /** Original text. */
  before: string;
  /** Revised text. */
  after: string;
  /** `unified` (default) or side-by-side `split`. */
  mode?: "unified" | "split";
  /** Unchanged context lines kept around each change (default 3). */
  context?: number;
  /** Highlight changed words within a line (default false). */
  wordLevel?: boolean;
  /** Render the line-number gutter (default true). */
  showLineNumbers?: boolean;
  /** Accessible label for the region. */
  label?: string;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/**
 * DitherDiffViewer — a unified or split (side-by-side) line diff. It computes
 * an LCS line diff internally (pure TS, no deps), then renders added/removed
 * lines with a **Bayer-dithered tint band** behind the text instead of a flat
 * highlight. Density encodes the change kind: added lines read denser, removed
 * lines sparser (a secondary lightness cue sharpens the distinction) — both in
 * the component's accent colour, so the diff reads as part of the kit rather
 * than as the conventional red/green.
 *
 * Unchanged runs collapse into a clickable "N hidden lines" expander once they
 * fall outside the `context` window (default 3). Optional `wordLevel` diff
 * flags the changed words within a paired remove/add.
 *
 * Accessibility: `role="region"` with an `aria-label`; the body is a
 * `<pre><code>` (semantics preserved); gap expanders are real buttons with
 * `aria-expanded`. The view is read-only, so there is no focus order to manage
 * beyond the expanders.
 *
 * SSR-safe: the tint tiles are baked in an effect (canvas only in the browser)
 * and re-measured on resize; ids derive from stable counts, not `Math.random`.
 */
export function DitherDiffViewer({
  before,
  after,
  mode = "unified",
  context = 3,
  wordLevel = false,
  showLineNumbers = true,
  label,
  color: colorProp,
  seed,
  className,
}: DitherDiffViewerProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const ops = useMemo(
    () => lcsDiff(before.replace(/\n$/, "").split("\n"), after.replace(/\n$/, "").split("\n")),
    [before, after],
  );
  const rows = useMemo(() => toRows(ops), [ops]);

  // Collapsed-gap state: a set of gap-start row indices the user unfolded.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  useEffect(() => {
    // Reset fold state when the inputs change meaningfully.
    setExpanded(new Set());
  }, [before, after, context]);
  const segments = useMemo(
    () => buildSegments(rows, context, expanded),
    [rows, context, expanded],
  );

  const beforeLines = before.replace(/\n$/, "").split("\n");
  const afterLines = after.replace(/\n$/, "").split("\n");
  const gutterDigits = String(Math.max(beforeLines.length, afterLines.length)).length;

  // Measure one rendered line and bake the add/remove tint tiles; re-measure on
  // resize so the band tracks the real line height.
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const [bands, setBands] = useState<{ add: string | null; remove: string | null; h: number } | null>(null);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const bake = () => {
      const node = measureRef.current;
      if (!node) return;
      const h = Math.ceil(node.offsetHeight);
      if (h <= 0) return;
      setBands({
        add: paintBandTile(0.92, 1, color, matrix, h),
        remove: paintBandTile(0.45, 0.7, color, matrix, h),
        h,
      });
    };
    const raf = requestAnimationFrame(() => {
      bake();
      if (typeof ResizeObserver !== "undefined" && regionRef.current) {
        ro = new ResizeObserver(bake);
        ro.observe(regionRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [color, matrix]);

  const bandStyleFor = (type: LineRow["type"]): CSSProperties | undefined => {
    if (!bands || type === "equal") return undefined;
    const url = type === "add" ? bands.add : bands.remove;
    if (!url) return undefined;
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: `${BAYER_PERIOD * CELL}px ${bands.h}px`,
      backgroundRepeat: "repeat",
    };
  };

  const toggleGap = (start: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(start)) next.delete(start);
      else next.add(start);
      return next;
    });
  };

  const renderText = (row: LineRow) => {
    if (!wordLevel || row.partner === null) {
      return <span className="whitespace-pre">{row.text || " "}</span>;
    }
    const segs = wordSegments(row.text, row.partner);
    return (
      <span className="whitespace-pre">
        {segs.map((seg, i) =>
          seg.changed ? (
            <mark
              key={i}
              className="rounded-[1px] bg-foreground/15 px-[1px] text-foreground underline decoration-dotted decoration-foreground/50 underline-offset-2"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </span>
    );
  };

  // A hidden single-line probe used only to measure line height for the bands.
  const probe = (
    <span ref={measureRef} aria-hidden="true" className="sr-only">
      0
    </span>
  );

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label={label ?? "Diff"}
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card/40 font-mono text-[12px] text-foreground",
        className,
      )}
    >
      {probe}
      <pre className="m-0 overflow-auto leading-relaxed">
        <code className={cn("block", mode === "split" ? "grid grid-cols-2" : "block")}>
          {segments.map((seg) => {
            if (seg.kind === "gap") {
              return (
                <div key={`gap-${seg.start}`} className="col-span-2 flex border-y border-border/40 bg-card/30">
                  <button
                    type="button"
                    aria-expanded={expanded.has(seg.start)}
                    onClick={() => toggleGap(seg.start)}
                    className={cn(
                      "mx-auto my-0.5 rounded border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors",
                      "hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 motion-reduce:transition-none",
                    )}
                  >
                    {expanded.has(seg.start)
                      ? "collapse"
                      : `⇕ ${seg.count} hidden line${seg.count === 1 ? "" : "s"}`}
                  </button>
                </div>
              );
            }
            const out: React.ReactNode[] = [];
            for (let k = seg.start; k < seg.end; k++) {
              const row = rows[k];
              const sign = row.type === "add" ? "+" : row.type === "remove" ? "−" : " ";
              if (mode === "split") {
                const left = row.type !== "add" ? row : null;
                const right = row.type !== "remove" ? row : null;
                out.push(
                  <div key={`r-${k}`} className="contents">
                    {renderSide(left, "before", gutterDigits, showLineNumbers, bandStyleFor, renderText)}
                    {renderSide(right, "after", gutterDigits, showLineNumbers, bandStyleFor, renderText)}
                  </div>,
                );
              } else {
                out.push(
                  <span key={`r-${k}`} className="flex">
                    {showLineNumbers && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 select-none px-2 text-right tabular-nums text-muted-foreground/70"
                        style={{ minWidth: `${gutterDigits + 1}ch` }}
                      >
                        {(row.type === "add" ? row.afterNo : row.beforeNo) ?? ""}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 select-none px-1",
                        row.type === "add"
                          ? "text-emerald-500/80"
                          : row.type === "remove"
                            ? "text-rose-500/80"
                            : "text-muted-foreground/40",
                      )}
                    >
                      {sign}
                    </span>
                    <span className="flex-1 whitespace-pre px-2" style={bandStyleFor(row.type)}>
                      {renderText(row)}
                    </span>
                  </span>,
                );
              }
            }
            return <span key={`seg-${seg.start}`} className="contents">{out}</span>;
          })}
        </code>
      </pre>
    </div>
  );
}

/** One half of a split row (left = before, right = after). `row` is null when
 *  that side has no line (a pure add leaves the left half empty, and vice
 *  versa) — a spacer keeps the two columns height-aligned. */
function renderSide(
  row: LineRow | null,
  side: "before" | "after",
  gutterDigits: number,
  showLineNumbers: boolean,
  bandStyleFor: (t: LineRow["type"]) => CSSProperties | undefined,
  renderText: (row: LineRow) => React.ReactNode,
) {
  if (!row) {
    return <span className="flex border-l border-border/30 bg-muted/10 px-2">&nbsp;</span>;
  }
  const no = side === "before" ? row.beforeNo : row.afterNo;
  const band = row.type === "equal" ? undefined : bandStyleFor(row.type);
  return (
    <span className="flex">
      {showLineNumbers && (
        <span
          aria-hidden="true"
          className="shrink-0 select-none px-2 text-right tabular-nums text-muted-foreground/70"
          style={{ minWidth: `${gutterDigits + 1}ch` }}
        >
          {no ?? ""}
        </span>
      )}
      <span className="flex-1 whitespace-pre px-2" style={band}>
        {renderText(row)}
      </span>
    </span>
  );
}
