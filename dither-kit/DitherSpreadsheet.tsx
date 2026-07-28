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

/** A plain string cell, or one carrying a cached value plus its source formula. */
export type DitherSpreadsheetCell = string | { value: string; formula?: string };

const COL_W = 108;
const FIRST_COL_W = 132;
const CELL_BACK = 2; // backing px per dither cell for the selection tile

// --- pure-TS formula evaluator (no deps) -------------------------------------
// Supports:  =SUM(A1:A3)  =SUM(A1,B2)  =A1+B1  =A1*2-(B3/C1)  number literals.
// Cell refs are A1-style (column letters, 1-based row). Non-numeric refs coerce
// to 0; cycles and parse errors surface as "#ERR".

function isFormula(raw: string): boolean {
  return raw.length > 1 && raw[0] === "=";
}

function parseRef(token: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)([0-9]+)$/.exec(token);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = parseInt(m[2], 10);
  if (col < 1 || row < 1) return null;
  return { col: col - 1, row: row - 1 };
}

type Tok =
  | { t: "num" | "ref" | "op"; v: string }
  | { t: "lp" | "rp" | "colon" | "comma" };
function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if ((ch >= "0" && ch <= "9") || (ch === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: "num", v: src.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9]/.test(src[j])) j++;
      toks.push({ t: "ref", v: src.slice(i, j) }); i = j; continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") { toks.push({ t: "op", v: ch }); i++; continue; }
    if (ch === "(") { toks.push({ t: "lp" }); i++; continue; }
    if (ch === ")") { toks.push({ t: "rp" }); i++; continue; }
    if (ch === ":") { toks.push({ t: "colon" }); i++; continue; }
    if (ch === ",") { toks.push({ t: "comma" }); i++; continue; }
    throw new Error("unexpected character");
  }
  return toks;
}

type EvalCtx = { ref: (tok: string) => number; range: (a: string, b: string) => number[] };

function evalFormula(raw: string, ctx: EvalCtx): number {
  const toks = tokenize(raw.slice(1));
  let pos = 0;
  const peek = (): Tok | undefined => toks[pos];
  const eat = (): Tok => toks[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "+" || tk.v === "-")) { eat(); const r = parseTerm(); v = tk.v === "+" ? v + r : v - r; }
      else break;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "*" || tk.v === "/")) { eat(); const r = parseFactor(); v = tk.v === "*" ? v * r : v / r; }
      else break;
    }
    return v;
  }
  function parseArg(): number {
    // Range literal (only meaningful inside SUM): ref : ref → expand to values.
    const a = peek();
    if (a && a.t === "ref") {
      const t1 = toks[pos + 1];
      const t2 = toks[pos + 2];
      if (t1 && t1.t === "colon" && t2 && t2.t === "ref") {
        pos += 3;
        return ctx.range(a.v, t2.v).reduce((x, y) => x + y, 0);
      }
    }
    return parseExpr();
  }
  function parseFactor(): number {
    const tk = peek();
    if (!tk) throw new Error("unexpected end");
    if (tk.t === "num") { eat(); return parseFloat(tk.v); }
    if (tk.t === "lp") { eat(); const v = parseExpr(); if (peek()?.t !== "rp") throw new Error("missing )"); eat(); return v; }
    if (tk.t === "ref") {
      eat();
      if (peek()?.t === "lp") {
        eat();
        const name = tk.v.toUpperCase();
        const args: number[] = [];
        if (peek()?.t !== "rp") {
          args.push(parseArg());
          while (peek()?.t === "comma") { eat(); args.push(parseArg()); }
        }
        if (peek()?.t !== "rp") throw new Error("missing ) in call");
        eat();
        if (name === "SUM") return args.reduce((x, y) => x + y, 0);
        throw new Error("unknown function " + name);
      }
      return ctx.ref(tk.v);
    }
    throw new Error("unexpected token");
  }

  const result = parseExpr();
  if (peek()) throw new Error("trailing tokens");
  return result;
}

function numOr0(text: string): number {
  if (text == null) return 0;
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1e6) / 1e6);
}

/** Build a recursive evaluator with per-pass memo + cycle guard. */
function makeEvaluator(grid: string[][], nRows: number, nCols: number) {
  const memo = new Map<string, number>();
  const stack = new Set<string>();
  function cellNum(r: number, c: number): number {
    const k = r + "," + c;
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    if (r < 0 || c < 0 || r >= nRows || c >= nCols) return 0;
    const raw = grid[r][c] ?? "";
    if (!isFormula(raw)) { const n = numOr0(raw); memo.set(k, n); return n; }
    if (stack.has(k)) throw new Error("cycle");
    stack.add(k);
    let val: number;
    try {
      val = evalFormula(raw, {
        ref: (tok) => { const p = parseRef(tok); if (!p) throw new Error("bad ref"); return cellNum(p.row, p.col); },
        range: (a, b) => {
          const pa = parseRef(a), pb = parseRef(b);
          if (!pa || !pb) throw new Error("bad range");
          const out: number[] = [];
          const r0 = Math.min(pa.row, pb.row), r1 = Math.max(pa.row, pb.row);
          const c0 = Math.min(pa.col, pb.col), c1 = Math.max(pa.col, pb.col);
          for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) out.push(cellNum(rr, cc));
          return out;
        },
      });
    } finally {
      stack.delete(k);
    }
    if (!Number.isFinite(val)) val = NaN;
    memo.set(k, val);
    return val;
  }
  return cellNum;
}

export interface DitherSpreadsheetProps {
  rows: DitherSpreadsheetCell[][];
  headers?: string[];
  editable?: boolean;
  onCellChange?: (row: number, col: number, value: string) => void;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Accessible label. */
  label?: string;
}

/** Paint the selection-band dither tile and return its data URL. Applied as a
 *  repeating background to every selected cell so a range reads as one
 *  contiguous Bayer band — never a flat blue. (Browser-only; SSR emits null.) */
function paintSelectionTile(color: PixelColor, matrix: number[][]): string | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 4;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const fill = fillOf(color);
  const density = 0.5;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const a = lit ? 0.22 : 0.06;
      ctx.fillStyle = rgb(fill, 1, a);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv.toDataURL();
}

/**
 * DitherSpreadsheet — a sticky-header / sticky-first-column cell grid. Selection
 * (single or range) is highlighted with a **Bayer-dithered band**: a tiled
 * dither wash applied to every selected cell, so a range reads as one
 * contiguous ordered-dither stripe rather than a flat tint.
 *
 * Cells accept `string` or `{value, formula?}`. Formulas — anything starting
 * with `=` — are evaluated by a tiny pure-TS evaluator (no deps): `=SUM(A1:A3)`,
 * `=SUM(A1,B2)`, `=A1+B1`, `=A1*2-(B3/C1)`. Cycles and parse errors show
 * `#ERR`; non-numeric refs coerce to 0 in numeric context.
 *
 * Accessibility: a WAI-ARIA `role="grid"`. The header row's cells are
 * `columnheader`s; the first (sticky) column's cells are `rowheader`s; body
 * cells are `gridcell`s with `aria-rowindex`/`aria-colindex`/`aria-selected`.
 * Roving tabindex lands on the active cell. Arrows move the active cell,
 * Shift+Arrows extend the range, Home/End jump to row/column edges, Ctrl/Cmd+C
 * copies the range as TSV, Enter/F2 (or a printable key, or double-click) edits
 * when `editable`, Tab/Enter commit and step, Esc cancels, Backspace clears.
 *
 * SSR / hydration: the selection tile is painted in an effect (canvas only in
 * the browser); all selection coordinates are integers; ids come from `useId`.
 */
export function DitherSpreadsheet({
  rows,
  headers,
  editable = false,
  onCellChange,
  color: colorProp,
  seed,
  className,
  label = "Spreadsheet",
}: DitherSpreadsheetProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "green";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const nRows = rows.length;
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, r.length), 0), [rows]);

  // Normalise to a rectangular raw-text grid (formulas kept as their "=..." source).
  const rawGrid = useMemo(() => {
    const g: string[][] = [];
    for (const row of rows) {
      const out: string[] = [];
      for (let c = 0; c < nCols; c++) {
        const cell = row[c];
        out.push(typeof cell === "string" ? cell : (cell.formula && cell.formula !== "" ? cell.formula : cell.value));
      }
      g.push(out);
    }
    return g;
  }, [rows, nCols]);

  const display = useMemo(() => {
    if (nRows === 0 || nCols === 0) return [] as string[][];
    const cellNum = makeEvaluator(rawGrid, nRows, nCols);
    const out: string[][] = [];
    for (let r = 0; r < nRows; r++) {
      const line: string[] = [];
      for (let c = 0; c < nCols; c++) {
        const raw = rawGrid[r][c] ?? "";
        if (!isFormula(raw)) { line.push(raw); continue; }
        try { const v = cellNum(r, c); line.push(Number.isFinite(v) ? formatNum(v) : "#ERR"); }
        catch { line.push("#ERR"); }
      }
      out.push(line);
    }
    return out;
  }, [rawGrid, nRows, nCols]);

  const colHeaders = useMemo(() => {
    if (headers && headers.length) {
      const h = headers.slice(0, nCols);
      while (h.length < nCols) h.push(colLetter(h.length));
      return h;
    }
    return Array.from({ length: nCols }, (_, c) => colLetter(c));
  }, [headers, nCols]);

  // --- selection (active + anchor → range rect) ------------------------------
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState("");

  const clampCell = useCallback((r: number, c: number) => ({
    r: Math.max(0, Math.min(nRows - 1, r)),
    c: Math.max(0, Math.min(nCols - 1, c)),
  }), [nRows, nCols]);

  const rect = useCallback(() => ({
    r0: Math.min(anchor.r, active.r), r1: Math.max(anchor.r, active.r),
    c0: Math.min(anchor.c, active.c), c1: Math.max(anchor.c, active.c),
  }), [anchor, active]);

  const inRange = useCallback((r: number, c: number) => {
    const { r0, r1, c0, c1 } = rect();
    return r >= r0 && r <= r1 && c >= c0 && c <= c1;
  }, [rect]);

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cellKey = (r: number, c: number) => `${r}-${c}`;
  const moveFocus = useCallback((r: number, c: number) => {
    queueMicrotask(() => cellRefs.current.get(cellKey(r, c))?.focus());
  }, []);

  const enterEdit = useCallback((r: number, c: number, seedChar?: string) => {
    if (!editable) return;
    setEditing({ r, c });
    setDraft(seedChar !== undefined ? seedChar : (rawGrid[r]?.[c] ?? ""));
  }, [editable, rawGrid]);

  const commitEdit = useCallback((step?: "down" | "right" | "left" | "up" | null) => {
    setEditing((cur) => {
      if (cur) {
        if (draft !== (rawGrid[cur.r]?.[cur.c] ?? "")) onCellChange?.(cur.r, cur.c, draft);
      }
      return null;
    });
    if (step) {
      const dr = step === "down" ? 1 : step === "up" ? -1 : 0;
      const dc = step === "right" ? 1 : step === "left" ? -1 : 0;
      const next = clampCell(active.r + dr, active.c + dc);
      setActive(next); setAnchor(next);
      moveFocus(next.r, next.c);
    }
  }, [draft, rawGrid, onCellChange, active, clampCell, moveFocus]);

  const copyRange = useCallback(() => {
    const { r0, r1, c0, c1 } = rect();
    const lines: string[] = [];
    for (let r = r0; r <= r1; r++) {
      const cells: string[] = [];
      for (let c = c0; c <= c1; c++) cells.push(display[r]?.[c] ?? "");
      lines.push(cells.join("\t"));
    }
    const tsv = lines.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tsv).catch(() => {});
    }
  }, [rect, display]);

  const onGridKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return; // the input owns keys while editing
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === "c" || e.key === "C")) { e.preventDefault(); copyRange(); return; }
    if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" || e.key === "Tab" || e.key === "Enter") e.preventDefault();
    const shift = e.shiftKey;
    switch (e.key) {
      case "ArrowRight": { const n = clampCell(active.r, active.c + 1); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "ArrowLeft": { const n = clampCell(active.r, active.c - 1); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "ArrowDown": { const n = clampCell(active.r + 1, active.c); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "ArrowUp": { const n = clampCell(active.r - 1, active.c); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "Home": { const n = clampCell(active.r, 0); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "End": { const n = clampCell(active.r, nCols - 1); setActive(n); if (!shift) setAnchor(n); moveFocus(n.r, n.c); return; }
      case "Tab": { const n = clampCell(active.r, active.c + (shift ? -1 : 1)); setActive(n); setAnchor(n); moveFocus(n.r, n.c); return; }
      case "Enter": { if (editable) enterEdit(active.r, active.c); return; }
      case "F2": { if (editable) enterEdit(active.r, active.c); return; }
      case "Backspace":
      case "Delete": { if (editable) onCellChange?.(active.r, active.c, ""); return; }
      default:
        if (editable && !mod && e.key.length === 1) enterEdit(active.r, active.c, e.key);
        return;
    }
  }, [editing, active, clampCell, nCols, editable, enterEdit, onCellChange, copyRange, moveFocus]);

  // --- selection dither tile (browser-only) ----------------------------------
  const [selTile, setSelTile] = useState<string | null>(null);
  useEffect(() => { setSelTile(paintSelectionTile(color, matrix)); }, [color, matrix]);
  const selBg = useMemo(() => selTile
    ? { backgroundImage: `url(${selTile})`, backgroundSize: `${8 * CELL_BACK}px ${4 * CELL_BACK}px`, backgroundRepeat: "repeat" as const }
    : undefined, [selTile]);

  const reactId = useId();
  const descId = `${reactId}-desc`;

  if (nRows === 0 || nCols === 0) {
    return (
      <div role="grid" aria-label={label} className={cn("rounded-md border border-border/60 bg-card/30 font-mono text-[12px] text-foreground", className)}>
        <div className="flex min-h-16 items-center justify-center text-muted-foreground">Empty grid</div>
      </div>
    );
  }

  const tmpl = `${FIRST_COL_W}px repeat(${nCols}, ${COL_W}px)`;

  return (
    <div
      role="grid"
      aria-label={label}
      aria-rowcount={nRows + 1}
      aria-colcount={nCols + 1}
      aria-readonly={editable ? undefined : true}
      aria-describedby={descId}
      onKeyDown={onGridKeyDown}
      className={cn("max-h-[28rem] overflow-auto rounded-md border border-border/60 font-mono text-[12px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/40", className)}
    >
      <div className="grid min-w-max" style={{ gridTemplateColumns: tmpl }}>
        {/* Header row: corner + column headers (sticky top). */}
        <div
          role="row"
          aria-rowindex={1}
          className="contents"
        >
          <div role="columnheader" aria-colindex={1} className="sticky left-0 top-0 z-30 border-b border-r border-border/60 bg-card px-2 py-1 text-[10px] text-muted-foreground">
            #
          </div>
          {colHeaders.map((h, c) => (
            <div
              key={c}
              role="columnheader"
              aria-colindex={c + 2}
              className="sticky top-0 z-20 border-b border-border/60 bg-card px-2 py-1 text-[11px] text-muted-foreground"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Body rows: sticky rowheader + cells. */}
        {display.map((line, r) => (
          <div role="row" aria-rowindex={r + 2} key={r} className="contents">
            <div
              role="rowheader"
              aria-colindex={1}
              className="sticky left-0 z-10 border-b border-r border-border/60 bg-card px-2 py-1 text-[10px] text-muted-foreground"
            >
              {r + 1}
            </div>
            {line.map((text, c) => {
              const selected = inRange(r, c);
              const isActive = active.r === r && active.c === c;
              const isEditing = editing?.r === r && editing?.c === c;
              return (
                <div
                  key={c}
                  ref={(el) => { if (el) cellRefs.current.set(cellKey(r, c), el); else cellRefs.current.delete(cellKey(r, c)); }}
                  role="gridcell"
                  aria-colindex={c + 2}
                  aria-selected={selected || undefined}
                  aria-readonly={editable ? undefined : true}
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => { setActive({ r, c }); if (!(active.r === r && active.c === c)) setAnchor({ r, c }); }}
                  onDoubleClick={() => enterEdit(r, c)}
                  className={cn(
                    "min-h-[28px] border-b border-border/30 px-2 py-1 outline-none",
                    "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground",
                    isActive && "z-0 ring-1 ring-inset ring-accent",
                    text === "#ERR" && "text-red-500",
                  )}
                  style={selected ? { ...selBg } : undefined}
                >
                  {isEditing ? (
                    <input
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      value={draft}
                      aria-label={`Edit cell ${colHeaders[c]}${r + 1}`}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitEdit(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitEdit("down"); }
                        else if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? "left" : "right"); }
                        else if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
                        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); commitEdit(e.key === "ArrowDown" ? "down" : "up"); }
                      }}
                      className="w-full bg-transparent text-foreground outline-none"
                    />
                  ) : (
                    <span className="block truncate">{text}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <span id={descId} className="sr-only">{`${label} with ${nCols} columns and ${nRows} rows. Arrow keys move, Shift+Arrows select a range, Ctrl+C copies as TSV${editable ? ", Enter edits" : ""}.`}</span>
    </div>
  );
}

function colLetter(index: number): string {
  let n = index;
  let out = "";
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}
