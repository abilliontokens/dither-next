"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { rubberband } from "./gesture";
import { cn } from "./lib";

const CELL = 2;

/** Paint a drop-target band — a dense Bayer strip that reads as a dithered
 *  "insert here" line (the kit's signature scatter, not a solid bar). Reused
 *  for both the pointer insertion slot and the keyboard "picked" marker. */
function paintDropBand(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  if (!ctx || w <= 0 || h <= 0) return;
  const cols = Math.max(2, Math.round(w / CELL));
  const rows = Math.max(1, Math.round(h / CELL));
  canvas.width = cols;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, cols, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const density = 0.72;
      const lit = density > matrix[y & 3][x & 3];
      ctx.fillStyle = rgb(fill, 1, lit ? 0.9 : 0.3);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export type KanbanColumn<T> = {
  id: string;
  title: string;
  cards: T[];
};

export interface DitherKanbanProps<T> {
  columns: KanbanColumn<T>[];
  /** Parent owns the board; every move fires this with the new column set. */
  onChange: (columns: KanbanColumn<T>[]) => void;
  /** Stable id for a card (generic `<T>` needs an extractor). */
  keyOf: (card: T) => string;
  /** Accessible label + drag-preview text for a card. Defaults to `keyOf`. */
  cardLabel?: (card: T) => string;
  /** Render a card's visible content. */
  renderCard: (card: T) => ReactNode;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

type PointerDrag = {
  key: string;
  fromCol: string;
  fromIdx: number;
  /** Floating-card fixed-viewport coords, edge-rubberbanded. */
  fx: number;
  fy: number;
  overCol: string;
  overIdx: number;
  /** Drop-band rect relative to the board. */
  band: { left: number; top: number; width: number };
};

/** Pure data move — find the card, lift it, drop it at (col, idx). */
function moveCard<T>(
  columns: KanbanColumn<T>[],
  key: string,
  toCol: string,
  toIdx: number,
  keyOf: (c: T) => string,
): KanbanColumn<T>[] {
  let card: T | null = null;
  const lifted = columns.map((col) => {
    const i = col.cards.findIndex((c) => keyOf(c) === key);
    if (i >= 0) {
      card = col.cards[i];
      return { ...col, cards: col.cards.filter((_, j) => j !== i) };
    }
    return col;
  });
  if (card === null) return columns;
  const clamped = Math.max(0, Math.min(toIdx, lifted.find((c) => c.id === toCol)?.cards.length ?? 0));
  return lifted.map((col) =>
    col.id === toCol
      ? { ...col, cards: [...col.cards.slice(0, clamped), card as T, ...col.cards.slice(clamped)] }
      : col,
  );
}

function locate<T>(columns: KanbanColumn<T>[], key: string, keyOf: (c: T) => string): { col: string; idx: number } | null {
  for (const col of columns) {
    const idx = col.cards.findIndex((c) => keyOf(c) === key);
    if (idx >= 0) return { col: col.id, idx };
  }
  return null;
}

/**
 * DitherKanban — a column board with pointer-draggable cards that also works
 * fully from the keyboard.
 *
 * Pointer: press a card, drag it 1:1; at the board edges the floating card
 * `rubberband`s (progressive resistance) instead of escaping. A dithered
 * Bayer drop-target band marks the live insertion slot. Release to drop.
 *
 * Keyboard: focus a card, Space/Enter picks it up, Arrow keys move it between
 * columns (Left/Right) and positions (Up/Down), Space/Enter drops, Escape
 * cancels and restores the pre-pick layout. Every move is announced through an
 * `aria-live` region. The board is `role="application"`; cards are buttons.
 *
 * The dither language lives in two places: the drop band (a dense Bayer strip
 * at the insertion slot) and the picked-card marker (the same strip at the
 * card's top edge) — interaction is what carries the pixel texture, so the
 * board itself stays a quiet dark surface. Generic over `<T>`; the parent owns
 * `columns` and receives every change via `onChange`. SSR-safe: ids from
 * `useId()`, all DOM-rect reads happen inside handlers/effects.
 */
export function DitherKanban<T>({
  columns,
  onChange,
  keyOf,
  cardLabel,
  renderCard,
  color: colorProp,
  seed,
  className,
}: DitherKanbanProps<T>) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;
  const labelOf = useCallback(
    (card: T) => (cardLabel ? cardLabel(card) : keyOf(card)),
    [cardLabel, keyOf],
  );

  const boardRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<Map<string, HTMLElement>>(new Map());
  const bandRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  // Values that affect rendered output live in state.
  const [drag, setDrag] = useState<PointerDrag | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  // Snapshot for Escape-cancel + a ref mirror so the keyboard handler (stable)
  // reads the freshest columns without rebuilding.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const snapshotRef = useRef<KanbanColumn<T>[] | null>(null);
  const pickedRef = useRef<string | null>(null);
  pickedRef.current = picked;
  const dragRef = useRef<PointerDrag | null>(null);
  dragRef.current = drag;

  const colIndex = useMemo(
    () => columns.map((c) => c.id),
    [columns],
  );

  // --- drop computation (DOM-rect reads; pointer-handler only) ---
  const computeDrop = useCallback((clientX: number, clientY: number): {
    overCol: string;
    overIdx: number;
    band: { left: number; top: number; width: number };
  } | null => {
    const board = boardRef.current;
    if (!board) return null;
    const brect = board.getBoundingClientRect();
    // Which column? Prefer a direct hit; else nearest by centre distance.
    let hit: string | null = null;
    let best = Infinity;
    for (const [id, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        hit = id;
        break;
      }
      const cx = r.left + r.width / 2;
      const d = Math.abs(clientX - cx);
      if (d < best) { best = d; hit = id; }
    }
    if (!hit) return null;
    const colEl = colRefs.current.get(hit);
    if (!colEl) return null;
    const r = colEl.getBoundingClientRect();
    const cards = Array.from(colEl.querySelectorAll<HTMLElement>("[data-card='1']"));
    let overIdx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const cr = cards[i].getBoundingClientRect();
      if (clientY < cr.top + cr.height / 2) { overIdx = i; break; }
    }
    let gapTop: number;
    if (overIdx < cards.length) gapTop = cards[overIdx].getBoundingClientRect().top;
    else if (cards.length) gapTop = cards[cards.length - 1].getBoundingClientRect().bottom;
    else gapTop = r.top + 36; // below header
    return {
      overCol: hit,
      overIdx,
      band: { left: r.left - brect.left + 8, top: gapTop - brect.top - 2, width: r.width - 16 },
    };
  }, []);

  const applyRubber = useCallback((clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { fx: clientX, fy: clientY };
    const r = board.getBoundingClientRect();
    const localX = clientX - r.left;
    const localY = clientY - r.top;
    const rx = localX < 0 ? rubberband(localX, r.width) : localX > r.width ? r.width + rubberband(localX - r.width, r.width) : localX;
    const ry = localY < 0 ? rubberband(localY, r.height) : localY > r.height ? r.height + rubberband(localY - r.height, r.height) : localY;
    return { fx: r.left + rx, fy: r.top + ry };
  }, []);

  // --- pointer drag ---
  const onCardPointerDown = useCallback(
    (key: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (pickedRef.current) return; // don't start a pointer drag mid keyboard-pick
      const loc = locate(columnsRef.current, key, keyOf);
      if (!loc) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const { fx, fy } = applyRubber(e.clientX, e.clientY);
      const drop = computeDrop(e.clientX, e.clientY);
      setDrag({
        key,
        fromCol: loc.col,
        fromIdx: loc.idx,
        fx,
        fy,
        overCol: drop?.overCol ?? loc.col,
        overIdx: drop?.overIdx ?? loc.idx,
        band: drop?.band ?? { left: 0, top: 0, width: 0 },
      });
    },
    [applyRubber, computeDrop, keyOf],
  );

  const onCardPointerMove = useCallback(
    (key: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      // rAF-coalesce the rect math.
      const cx = e.clientX;
      const cy = e.clientY;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const { fx, fy } = applyRubber(cx, cy);
        const drop = computeDrop(cx, cy);
        setDrag((d) => (d && d.key === key
          ? { ...d, fx, fy, overCol: drop?.overCol ?? d.overCol, overIdx: drop?.overIdx ?? d.overIdx, band: drop?.band ?? d.band }
          : d));
      });
    },
    [applyRubber, computeDrop],
  );

  const endPointerDrag = useCallback(
    (key: string) => () => {
      const d = dragRef.current;
      if (d && d.key === key) {
        onChange(moveCard(columnsRef.current, key, d.overCol, d.overIdx, keyOf));
      }
      setDrag(null);
    },
    [onChange, keyOf],
  );

  // --- keyboard reorder ---
  const onCardKeydown = useCallback(
    (key: string) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const isPicked = pickedRef.current === key;
      if (e.key === "Escape" && isPicked) {
        e.preventDefault();
        if (snapshotRef.current) onChange(snapshotRef.current);
        snapshotRef.current = null;
        setPicked(null);
        setAnnounce("Move cancelled");
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isPicked) {
          snapshotRef.current = columnsRef.current;
          setPicked(key);
          const loc = locate(columnsRef.current, key, keyOf);
          const col = columnsRef.current.find((c) => c.id === loc?.col);
          const card = col && loc ? col.cards[loc.idx] : null;
          setAnnounce(
            `Picked up ${card ? labelOf(card) : "card"}. In column ${col?.title ?? ""}. Use arrows to move, space to drop, escape to cancel.`,
          );
        } else {
          setPicked(null);
          snapshotRef.current = null;
          setAnnounce("Dropped");
        }
        return;
      }
      if (!isPicked) return;
      const loc = locate(columnsRef.current, key, keyOf);
      if (!loc) return;
      let toCol = loc.col;
      let toIdx = loc.idx;
      let moved = false;
      switch (e.key) {
        case "ArrowRight": {
          const i = colIndex.indexOf(loc.col);
          if (i + 1 < colIndex.length) { toCol = colIndex[i + 1]; toIdx = loc.idx; moved = true; }
          break;
        }
        case "ArrowLeft": {
          const i = colIndex.indexOf(loc.col);
          if (i - 1 >= 0) { toCol = colIndex[i - 1]; toIdx = loc.idx; moved = true; }
          break;
        }
        case "ArrowUp":
          if (loc.idx > 0) { toIdx = loc.idx - 1; moved = true; }
          break;
        case "ArrowDown": {
          const len = columnsRef.current.find((c) => c.id === loc.col)?.cards.length ?? 0;
          if (loc.idx < len - 1) { toIdx = loc.idx + 1; moved = true; }
          break;
        }
      }
      if (!moved) return;
      e.preventDefault();
      const next = moveCard(columnsRef.current, key, toCol, toIdx, keyOf);
      onChange(next);
      const newLoc = locate(next, key, keyOf);
      const colTitle = next.find((c) => c.id === toCol)?.title ?? "";
      setAnnounce(`Moved to ${colTitle}, position ${(newLoc?.idx ?? 0) + 1}`);
    },
    [colIndex, onChange, keyOf, labelOf],
  );

  // Paint the drop band whenever its rect changes.
  useEffect(() => {
    if (!drag || !bandRef.current) return;
    const canvas = bandRef.current;
    const raf = requestAnimationFrame(() => paintDropBand(canvas, color, matrix));
    return () => cancelAnimationFrame(raf);
  }, [drag, color, matrix]);

  // Clean up any pending rAF on unmount.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div
      ref={boardRef}
      role="application"
      aria-label="Kanban board. Focus a card, press space to pick it up, arrow keys to move between columns and positions, space to drop, escape to cancel."
      className={cn("relative flex touch-none select-none gap-3 overflow-auto", className)}
    >
      <span className="sr-only" role="status" aria-live="assertive">
        {announce}
      </span>

      {columns.map((col) => (
        <section
          key={col.id}
          aria-label={`${col.title}, ${col.cards.length} cards`}
          className="flex w-64 shrink-0 flex-col rounded-md border border-border/50 bg-card/40"
        >
          <header className="flex items-center justify-between px-3 py-2">
            <h3 className="font-mono text-[12px] text-foreground">{col.title}</h3>
            <span className="rounded border border-border/60 px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              {col.cards.length}
            </span>
          </header>
          <ul
            ref={(el) => {
              if (el) colRefs.current.set(col.id, el);
              else colRefs.current.delete(col.id);
            }}
            className="flex flex-col gap-2 p-2"
          >
            {col.cards.map((card) => {
              const key = keyOf(card);
              const isPicked = picked === key;
              const isDragging = drag?.key === key;
              return (
                <li key={key} data-card="1" className="relative">
                  {isPicked && (
                    <canvas
                      aria-hidden="true"
                      className="absolute -top-1 left-0 h-[3px] w-full"
                      ref={(el) => {
                        if (el) requestAnimationFrame(() => paintDropBand(el, color, matrix));
                      }}
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${labelOf(card)}${isPicked ? ", picked up" : ""}`}
                    aria-grabbed={isPicked || undefined}
                    onPointerDown={onCardPointerDown(key)}
                    onPointerMove={onCardPointerMove(key)}
                    onPointerUp={endPointerDrag(key)}
                    onPointerCancel={endPointerDrag(key)}
                    onKeyDown={onCardKeydown(key)}
                    className={cn(
                      "rounded border bg-card p-2 font-mono text-[12px] text-foreground transition-shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                      isPicked ? "border-foreground/60 ring-1 ring-foreground/30" : "border-border/60",
                      isDragging ? "opacity-30" : "",
                    )}
                  >
                    {renderCard(card)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* Dithered drop-target band (pointer drag insertion slot). */}
      {drag && (
        <canvas
          ref={bandRef}
          aria-hidden="true"
          className="pointer-events-none absolute h-[4px]"
          style={{
            left: `${drag.band.left}px`,
            top: `${drag.band.top}px`,
            width: `${drag.band.width}px`,
            imageRendering: "pixelated",
          }}
        />
      )}

      {/* Floating card follows the pointer 1:1, edge-rubberbanded. */}
      {drag &&
        (() => {
          const card = (() => {
            for (const col of columnsRef.current) {
              const c = col.cards.find((x) => keyOf(x) === drag.key);
              if (c) return c;
            }
            return null;
          })();
          if (!card) return null;
          return (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-50 w-64 -translate-x-1/2 -translate-y-1/2 rotate-1 rounded border border-foreground/40 bg-card p-2 font-mono text-[12px] text-foreground shadow-lg"
              style={{ left: `${drag.fx}px`, top: `${drag.fy}px` }}
            >
              {renderCard(card)}
            </div>
          );
        })()}
    </div>
  );
}
