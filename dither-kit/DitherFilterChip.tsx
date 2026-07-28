"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { CONTROL_BUTTON, POPOVER } from "./control";
import { cn } from "./lib";
import { BAYER4, clamp01, fillOf, type PixelColor } from "./pixel";
import { rgb, type Rgb } from "./palette";
import { usePresence } from "./use-presence";

const CELL = 2;

/**
 * Paint the chip's border as a Bayer-dithered ring whose density grows with the
 * number of selected options — the chip's signature dither element. Only the
 * 1-cell perimeter is painted; the interior stays clear so the chip face shows
 * through. Density, not a flat hue, encodes "how active".
 */
function paintBorder(
  canvas: HTMLCanvasElement,
  density: number,
  color: PixelColor,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cols = Math.max(4, Math.round(canvas.clientWidth / CELL));
  const rows = Math.max(3, Math.round(canvas.clientHeight / CELL));
  if (canvas.width !== cols) canvas.width = cols;
  if (canvas.height !== rows) canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  const fill: Rgb = fillOf(color);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const onEdge = x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1;
      if (!onEdge) continue;
      const tx = BAYER4[y & 3][x & 3];
      const alpha = density > tx ? 0.8 : 0.14;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export interface DitherFilterOption {
  value: string;
  label: string;
}

export interface DitherFilterChipProps {
  /** Chip face label. */
  label: string;
  options: DitherFilterOption[];
  /** Currently committed selection. */
  value?: string[];
  onChange?: (values: string[]) => void;
  className?: string;
}

/**
 * DitherFilterChip — a discrete filter chip that opens a popover of checkbox
 * options. Idle, it reads as a faint muted chip; selecting options ignites a
 * Bayer-dithered border ramp that gets denser the more is selected (density, not
 * a flat hue), plus a count badge.
 *
 * The popover holds a search input + a checkbox group + Apply/Clear. Selection is
 * a draft-then-commit model: toggles stage a local draft, Apply commits via
 * `onChange` and closes, Clear empties and commits `[]`, Escape reverts and
 * closes. Keyboard: Enter/Space opens the chip; in the popover, arrows walk the
 * options (roving tabindex), Space/Enter toggles, Escape closes, Tab reaches
 * Apply/Clear.
 *
 * SSR-safe: the border canvas paints in an effect; the popover mounts only when
 * open (no portal needed — it anchors to the in-flow chip wrapper).
 */
export function DitherFilterChip({
  label,
  options,
  value,
  onChange,
  className,
}: DitherFilterChipProps) {
  const reactId = useId();
  const dialogId = `${reactId}-dialog`;
  const groupId = `${reactId}-group`;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value ?? []);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const mounted = usePresence(open, 140);

  const count = value?.length ?? 0;
  const isActive = count > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const density = isActive
    ? clamp01(0.28 + 0.62 * (count / Math.max(1, options.length)))
    : 0.3;
  const borderColor: PixelColor = isActive ? "blue" : "grey";

  // Repaint the dithered border when the selection (→ density) or size changes.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      if (ringRef.current) paintBorder(ringRef.current, density, borderColor);
      if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
        ro = new ResizeObserver(() => {
          if (ringRef.current) paintBorder(ringRef.current, density, borderColor);
        });
        ro.observe(wrapRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [density, borderColor]);

  // Initialise the draft + focus the search input when the popover opens.
  useEffect(() => {
    if (!open) return;
    setDraft(value ? [...value] : []);
    setQuery("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, value]);

  // Close on outside pointer-down — the popover is non-modal, so a click outside
  // the chip wrapper dismisses it (Escape still closes too). Attached only while
  // open; the chip sits inside `wrapRef`, so toggling it by click is unaffected.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent): void {
      const node = wrapRef.current;
      if (node && !node.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(): void {
    setOpen(false);
  }
  function toggle(optValue: string): void {
    setDraft((d) => (d.includes(optValue) ? d.filter((v) => v !== optValue) : [...d, optValue]));
  }
  function apply(): void {
    onChange?.(draft);
    close();
  }
  function clear(): void {
    setDraft([]);
    onChange?.([]);
    close();
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = filtered.length ? Math.min(active, filtered.length - 1) : 0;
      setActive(ni);
      boxRefs.current[ni]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function onGroupKey(e: KeyboardEvent<HTMLDivElement>): void {
    const n = filtered.length;
    if (!n) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = (active + 1) % n;
      setActive(ni);
      boxRefs.current[ni]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = (active - 1 + n) % n;
      setActive(ni);
      boxRefs.current[ni]?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) toggle(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className="relative rounded-[6px] p-[2px] focus-visible:outline-none"
        onClick={() => setOpen((o) => !o)}
      >
        <canvas
          ref={ringRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full rounded-[6px]"
          style={{ imageRendering: "pixelated" }}
        />
        <span
          className={cn(
            "relative flex items-center gap-1.5 rounded-[4px] bg-card px-2.5 py-1 font-mono text-[12px]",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span>{label}</span>
          {isActive ? (
            <span
              aria-hidden="true"
              className="grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-bold leading-none text-background"
            >
              {count}
            </span>
          ) : null}
          <span aria-hidden="true" className="text-muted-foreground">
            {open ? "▴" : "▾"}
          </span>
        </span>
      </button>

      {mounted ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`${label} filter options`}
          className={cn(
            "absolute left-0 top-full z-30 mt-1 min-w-[12rem] w-max max-w-[18rem]",
            POPOVER,
            !open && "pointer-events-none opacity-0",
          )}
        >
          <div className="border-b border-border/60 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Filter…"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Filter ${label} options`}
              className="h-7 w-full rounded border border-border/60 bg-background/60 px-2 font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-accent/40"
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onInputKey}
            />
          </div>
          <div
            id={groupId}
            role="group"
            aria-label={`${label} options`}
            className="max-h-56 overflow-y-auto p-1.5"
            onKeyDown={onGroupKey}
          >
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] italic text-muted-foreground">no matches</div>
            ) : null}
            {filtered.map((o, i) => {
              const checked = draft.includes(o.value);
              return (
                <button
                  key={o.value}
                  ref={(el) => {
                    boxRefs.current[i] = el;
                  }}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={i === active ? 0 : -1}
                  className={cn(
                    CONTROL_BUTTON,
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
                    i === active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                  onClick={() => toggle(o.value)}
                  onPointerEnter={() => setActive(i)}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-3.5 shrink-0 place-items-center border border-border"
                    style={{ backgroundColor: checked ? "var(--foreground, currentColor)" : "transparent" }}
                  >
                    {checked ? (
                      <span className="text-[9px] leading-none text-background">✓</span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-1.5 border-t border-border/60 p-2">
            <button
              type="button"
              className={cn(CONTROL_BUTTON, "rounded border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground")}
              onClick={clear}
            >
              Clear
            </button>
            <button
              type="button"
              className={cn(CONTROL_BUTTON, "rounded border border-border/60 bg-foreground px-2 py-1 text-[11px] text-background hover:opacity-90")}
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
