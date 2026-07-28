"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { CONTROL } from "./control";
import { cn } from "./lib";
import { BAYER4 } from "./pixel";
import { hexToRgb } from "./palette";

const LEVELS = 4;
const TILE = 14; // backing cells per swatch tile (one Bayer period ×~3.5)
const PITCH = 34; // css px between swatch origins (28px tile + 6px gap)

/**
 * Ordered-dither a single channel to `LEVELS` steps — the same quantization the
 * picker/slider paint with, so a flat swatch hex reads through the kit's texture.
 */
function ditherChannel(c: number, t: number): number {
  const offset = (t - 0.5) / LEVELS;
  const v = c + offset;
  const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(clamped * (LEVELS - 1)) / (LEVELS - 1);
}

/**
 * Paint a swatch tile as the dithered approximation of its hex — each cell is the
 * colour quantised to four levels per channel through `BAYER4`, so the tile shows
 * how the dither engine renders the hue at the kit's limited palette rather than
 * a flat fill. Backing is `TILE×TILE` (several Bayer periods) and CSS-scaled up
 * `pixelated`, matching the slider/picker canvas idiom.
 */
function paintSwatch(canvas: HTMLCanvasElement, hex: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = TILE;
  canvas.height = TILE;
  const [r, g, b] = hexToRgb(hex);
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const tx = BAYER4[y & 3][x & 3];
      const o = (y * TILE + x) * 4;
      d[o] = Math.round(ditherChannel(r / 255, tx) * 255);
      d[o + 1] = Math.round(ditherChannel(g / 255, tx) * 255);
      d[o + 2] = Math.round(ditherChannel(b / 255, tx) * 255);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface DitherSwatch {
  name: string;
  /** `#rrggbb` (or `#rgb`); normalised on the way out via `hexToRgb`→`rgbToHex`. */
  hex: string;
  /** Optional grouping key; swatches sharing a key render under one header. */
  group?: string;
}

export interface DitherColorPaletteProps {
  swatches: DitherSwatch[];
  /** Currently selected hex (`#rrggbb`); the matching tile gets a selection ring. */
  value?: string;
  onChange?: (hex: string) => void;
  /** When provided, an "add" button persists a custom hex as a swatch. */
  onAddCustom?: (hex: string) => void;
  /** Accessible name for the palette grid. */
  label?: string;
  className?: string;
}

/** A single dithered swatch tile. Owns its canvas; repaints only on hex change. */
function SwatchTile({ hex }: { hex: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) paintSwatch(ref.current, hex);
  }, [hex]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="block size-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/**
 * DitherColorPalette — a swatch palette where every tile is rendered through the
 * kit's Bayer-dither engine, so designers preview how a colour reads at the kit's
 * limited palette before committing it. Distinct from `DitherColorPicker`, which
 * is an HSV field with a hue rail.
 *
 * Features: optional grouping headers, a search filter (name or hex), copy-hex-on-
 * click (clipboard write with a transient check), a custom-hex input, and full 2D
 * grid keyboard navigation (arrows walk, Home/End jump, roving tabindex).
 *
 * The grid uses `role="grid"` with direct `role="gridcell"` tiles and a measured
 * column count (ResizeObserver) so arrow math matches the laid-out columns; row
 * wrappers are omitted because CSS-grid auto-placement owns the rows. The column
 * count starts at a default and updates after mount — SSR-stable.
 *
 * SSR-safe: swatch canvases paint in effects only; `navigator.clipboard` is read
 * inside a click handler; ids come from `useId()`.
 */
export function DitherColorPalette({
  swatches,
  value,
  onChange,
  onAddCustom,
  label = "Colour palette",
  className,
}: DitherColorPaletteProps) {
  const reactId = useId();
  const gridId = `${reactId}-grid`;
  const searchId = `${reactId}-search`;
  const hexInputId = `${reactId}-hex`;

  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copyTimer = useRef<number>(0);

  const [query, setQuery] = useState("");
  const [cols, setCols] = useState(6);
  const [focusIdx, setFocusIdx] = useState(0);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState(value ?? "");
  const [hexFocused, setHexFocused] = useState(false);

  const selected = value?.toLowerCase();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return swatches;
    return swatches.filter(
      (s) => s.name.toLowerCase().includes(q) || s.hex.toLowerCase().includes(q),
    );
  }, [swatches, query]);

  const groups = useMemo(() => {
    const out = new Map<string, DitherSwatch[]>();
    for (const sw of visible) {
      const g = sw.group ?? "";
      if (!out.has(g)) out.set(g, []);
      out.get(g)!.push(sw);
    }
    return [...out.entries()];
  }, [visible]);

  // Measure the laid-out column count so arrow math matches reality.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const measure = (): void => {
      const node = gridRef.current;
      if (!node) return;
      const w = node.clientWidth;
      setCols(Math.max(1, Math.round((w + 6) / PITCH)));
    };
    const raf = requestAnimationFrame(() => {
      measure();
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(measure);
        if (gridRef.current) ro.observe(gridRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  // Start keyboard focus on the selected tile (or the first) when the selection
  // or the visible set changes — so arrow nav begins where the user already is.
  useEffect(() => {
    if (selected) {
      const i = visible.findIndex((s) => s.hex.toLowerCase() === selected);
      setFocusIdx(i >= 0 ? i : 0);
    } else {
      setFocusIdx(0);
    }
  }, [selected, visible]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  function copy(hex: string): void {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(hex);
        setCopiedHex(hex);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopiedHex(null), 1500);
      }
    } catch {
      // Clipboard unavailable — selection still fires via onChange.
    }
  }

  function pick(hex: string): void {
    onChange?.(hex);
    copy(hex);
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>): void {
    const n = visible.length;
    if (!n) return;
    let next = focusIdx;
    if (e.key === "ArrowRight") next = focusIdx + 1;
    else if (e.key === "ArrowLeft") next = focusIdx - 1;
    else if (e.key === "ArrowDown") next = focusIdx + cols;
    else if (e.key === "ArrowUp") next = focusIdx - cols;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    next = Math.max(0, Math.min(n - 1, next));
    setFocusIdx(next);
    cellRefs.current[next]?.focus();
  }

  function onHexChange(raw: string): void {
    setHexDraft(raw);
    let h = raw.trim();
    if (!h.startsWith("#")) h = `#${h}`;
    if (/^#[0-9a-fA-F]{6}$/.test(h) || /^#[0-9a-fA-F]{3}$/.test(h)) {
      const [r, g, b] = hexToRgb(h);
      const norm = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      onChange?.(norm);
    }
  }

  let flat = 0;
  const showCopied = copiedHex !== null;

  return (
    <div className={cn("w-full text-foreground", className)}>
      <div className="mb-2 flex items-center gap-2">
        <input
          id={searchId}
          type="text"
          value={query}
          placeholder="Filter swatches…"
          autoComplete="off"
          spellCheck={false}
          aria-label={`${label}, filter`}
          className={cn(CONTROL, "h-8 flex-1 text-[12px]")}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      <div
        ref={gridRef}
        role="grid"
        id={gridId}
        aria-label={label}
        aria-colcount={cols}
        className="grid gap-1.5 outline-none"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        onKeyDown={onGridKey}
      >
        {visible.length === 0 ? (
          <div className="col-span-full py-4 text-center text-[12px] italic text-muted-foreground">
            no swatches match
          </div>
        ) : null}
        {groups.map(([group, items]) => (
          <Fragment key={group || "default"}>
            {group ? (
              <div
                role="rowheader"
                aria-colspan={cols}
                className="col-span-full pt-1 pb-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70"
              >
                {group}
              </div>
            ) : null}
            {items.map((sw) => {
              const idx = flat++;
              const isSel = sw.hex.toLowerCase() === selected;
              const isCopied = showCopied && copiedHex === sw.hex.toLowerCase();
              return (
                <button
                  key={`${group}-${sw.name}-${sw.hex}`}
                  ref={(el) => {
                    cellRefs.current[idx] = el;
                  }}
                  type="button"
                  role="gridcell"
                  tabIndex={idx === focusIdx ? 0 : -1}
                  aria-selected={isSel}
                  aria-label={`${sw.name}, ${sw.hex}${isCopied ? ", copied" : ""}`}
                  title={sw.hex}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-[2px] outline-none transition-transform motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:scale-[1.06]",
                    isSel ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "",
                  )}
                  onClick={() => pick(sw.hex)}
                >
                  <SwatchTile hex={sw.hex} />
                  {isCopied ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 grid place-items-center bg-background/60 text-[10px] font-bold text-foreground"
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-[2px] border border-border"
          style={{ backgroundColor: value ?? "transparent", imageRendering: "pixelated" }}
        />
        <input
          id={hexInputId}
          type="text"
          value={hexFocused ? hexDraft : (value ?? hexDraft)}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label}, custom hex`}
          className={cn(CONTROL, "h-8 w-28 font-mono text-[12px] uppercase")}
          onFocus={() => setHexFocused(true)}
          onBlur={() => {
            setHexFocused(false);
            setHexDraft(value ?? "");
          }}
          onChange={(e) => onHexChange(e.currentTarget.value)}
        />
        {onAddCustom ? (
          <button
            type="button"
            className={cn(
              CONTROL,
              "h-8 shrink-0 px-2 text-[12px] hover:border-foreground/25",
            )}
            onClick={() => {
              const v = (value ?? hexDraft).trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
                const [r, g, b] = hexToRgb(v);
                const norm = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
                onAddCustom(norm);
              }
            }}
          >
            add
          </button>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {showCopied ? `Copied ${copiedHex}` : ""}
        </span>
      </div>
    </div>
  );
}

