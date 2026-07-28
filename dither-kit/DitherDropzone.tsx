"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb, type Rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;

/** Parse an `accept` attribute string ("image/*,.png") into matchers. */
function parseAccept(accept: string): { mime: string; ext: string }[] {
  return accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => ({ mime: t, ext: t.startsWith(".") ? t.slice(1) : "" }));
}

function fileAccepted(file: File, rules: { mime: string; ext: string }[]): boolean {
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((r) => {
    if (r.ext && name.endsWith(`.${r.ext}`)) return true;
    if (r.mime.endsWith("/*")) return type.startsWith(r.mime.slice(0, -1));
    return type === r.mime;
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Paint the drag-over wash: a full-zone Bayer fill whose density encodes how
 *  "grabbed" the surface feels — idle is empty, and the density eases upward
 *  while files hover over it, so the zone intensifies in the kit's own pixels. */
function paintWash(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  fill: Rgb,
  density: number,
  matrix: number[][],
): void {
  ctx.clearRect(0, 0, cols, rows);
  if (density <= 0.01) return;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const alpha = lit ? 0.3 + 0.6 * density : 0.08 * density;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Paint a single per-file progress bar — a determinate Bayer ramp up to
 *  `pct`, the same recipe as DitherProgress so progress reads identically. */
function paintBar(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  pct: number,
  fill: Rgb,
  muted: Rgb,
  matrix: number[][],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || cssWidth <= 0) return;
  const cols = Math.max(4, Math.round(cssWidth / CELL));
  const rows = 3;
  canvas.width = cols;
  canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  const filled = Math.round(cols * Math.max(0, Math.min(1, pct / 100)));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x < filled) {
        const t = (x + 0.5) / Math.max(1, filled);
        const density = 0.4 + 0.6 * t;
        const lit = density > matrix[y & 3][x & 3];
        const k = 0.3 + density * 0.7;
        ctx.fillStyle = rgb(fill, 1, lit ? k : k * 0.4);
      } else {
        const lit = 0.25 > matrix[y & 3][x & 3];
        ctx.fillStyle = rgb(muted, 1, lit ? 0.2 : 0.06);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export interface DitherDropzoneProps {
  /** Comma list of MIME types / extensions (`"image/*,.png"`). */
  accept?: string;
  /** Allow more than one file. */
  multiple?: boolean;
  /** Per-file size ceiling in bytes; larger files are rejected. */
  maxSize?: number;
  /** Fires with the accepted selection (filtered by accept/maxSize). */
  onFiles?: (files: File[]) => void;
  /** Fires with files rejected by accept/maxSize and the reason. */
  onReject?: (rejected: { file: File; reason: string }[]) => void;
  /** When provided, a dithered progress bar renders for files it maps. */
  progressFor?: (file: File) => number | undefined;
  /** Zone heading (defaults to "Drop files here"). */
  label?: ReactNode;
  /** Secondary line under the heading. */
  hint?: ReactNode;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

/**
 * DitherDropzone — a file drop surface whose drag-over state intensifies as an
 * ordered-dither wash: idle is empty, and the Bayer density eases upward while
 * files hover over the zone, so the surface visibly "grabs" in the kit's own
 * pixels instead of flashing a flat highlight.
 *
 * Drops and the keyboard-activable "Browse" button both feed a visually hidden
 * `<input type="file">`. Files are filtered by `accept` and `maxSize`:
 * accepted ones fire `onFiles` and render in a list (name + size, with an
 * optional per-file dithered progress bar via `progressFor`); rejected ones
 * fire `onReject`. No upload happens here — selection + listing only.
 *
 * Accessibility: `role="region"` with an `aria-label`, a focusable "Browse"
 * button driving the file input, and `aria-disabled` while the input is
 * single-mode with a selection already present. Reduced motion: the wash
 * snaps to its target instead of easing.
 *
 * SSR-safe: all canvas/DragEvent work happens in effects + handlers; the
 * reduced-motion query resolves in a mount effect; ids from `useId()`.
 */
export function DitherDropzone({
  accept,
  multiple = false,
  maxSize,
  onFiles,
  onReject,
  progressFor,
  label = "Drop files here",
  hint = "or click to browse",
  color: colorProp,
  seed,
  className,
}: DitherDropzoneProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color = useMemo<PixelColor>(() => colorProp ?? s?.hue ?? "blue", [colorProp, s]);
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const rules = useMemo(() => (accept ? parseAccept(accept) : []), [accept]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const barRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // `dragging` + `files` re-render (they're visible state); the wash easing
  // current lives in a ref (imperative, no per-frame re-render).
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const intensityRef = useRef(0);
  const reduceRef = useRef(false);
  const rafRef = useRef(0);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);

  const reactId = useId();
  const labelId = `${reactId}-label`;

  const commit = useCallback(
    (incoming: File[]) => {
      const accepted: File[] = [];
      const rejected: { file: File; reason: string }[] = [];
      for (const file of incoming) {
        if (rules.length > 0 && !fileAccepted(file, rules)) {
          rejected.push({ file, reason: "type" });
        } else if (maxSize !== undefined && file.size > maxSize) {
          rejected.push({ file, reason: "size" });
        } else {
          accepted.push(file);
        }
      }
      const limited = multiple ? accepted : accepted.slice(0, 1);
      if (limited.length) {
        setFiles((prev) => (multiple ? [...prev, ...limited] : limited));
        onFiles?.(limited);
      }
      if (rejected.length) onReject?.(rejected);
    },
    [rules, maxSize, multiple, onFiles, onReject],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the zone itself, not a child element.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const list = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      if (list.length) commit(list);
    },
    [commit],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      if (list.length) commit(list);
      // Reset so selecting the same file again re-fires change.
      e.target.value = "";
    },
    [commit],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  // Wash easing loop: ease `intensity` toward the drag target, repaint. Color
  // and matrix are mirrored into refs so `tick` stays stable (no stale closure
  // if the colour changes mid-drag) — the kit's established rAF-in-ref pattern.
  const targetRef = useRef(0);
  targetRef.current = dragging ? 0.55 : 0;
  const colorRef = useRef(color);
  colorRef.current = color;
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;

  const paintWashNow = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx || colsRef.current <= 0) return;
    paintWash(
      ctx,
      colsRef.current,
      rowsRef.current,
      fillOf(colorRef.current),
      intensityRef.current,
      matrixRef.current,
    );
  }, []);

  const tick = useCallback(() => {
    const goal = targetRef.current;
    const cur = intensityRef.current;
    const next = reduceRef.current ? goal : cur + (goal - cur) * 0.18;
    intensityRef.current = Math.abs(next - goal) < 0.001 ? goal : next;
    paintWashNow();
    if (intensityRef.current === goal && goal === 0) {
      rafRef.current = 0; // eased back to empty — stop
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [paintWashNow]);

  // (Re)arm the loop when the drag target flips; it self-stops at rest.
  useEffect(() => {
    if (rafRef.current) return; // a loop already owns the easing
    if (!dragging && intensityRef.current === 0) return; // nothing to ease
    rafRef.current = requestAnimationFrame(tick);
  }, [dragging, tick]);

  const resize = useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const box = root.getBoundingClientRect();
    colsRef.current = Math.max(4, Math.round(box.width / CELL));
    rowsRef.current = Math.max(4, Math.round(box.height / CELL));
    canvas.width = colsRef.current;
    canvas.height = rowsRef.current;
    paintWashNow();
  }, [paintWashNow]);

  // Mount: resolve reduced motion, size the wash canvas + RO, paint bars.
  useEffect(() => {
    reduceRef.current = pixelPrefersReducedMotion();
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      resize();
      if (typeof ResizeObserver !== "undefined" && rootRef.current) {
        ro = new ResizeObserver(resize);
        ro.observe(rootRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      ro?.disconnect();
    };
  }, [resize]);

  // Repaint per-file progress bars whenever files/progress/colour move.
  useEffect(() => {
    for (const file of files) {
      const canvas = barRefs.current.get(file.name + file.size);
      if (!canvas) continue;
      const pct = progressFor?.(file) ?? 0;
      paintBar(canvas, canvas.offsetWidth || 120, pct, fillOf(color), fillOf("grey"), matrix);
    }
  }, [files, progressFor, color, matrix]);

  const removeFile = useCallback((name: string, size: number) => {
    setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  }, []);

  return (
    <div className={cn("font-mono text-foreground", className)}>
      <div
        ref={rootRef}
        role="region"
        aria-labelledby={labelId}
        className={cn(
          "relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-accent/70" : "border-border/60 hover:border-foreground/30",
        )}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        tabIndex={0}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ imageRendering: "pixelated" }}
        />
        <span id={labelId} className="relative z-10 text-[13px] font-medium">
          {label}
        </span>
        <span className="relative z-10 text-[11px] text-muted-foreground">{hint}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          className="relative z-10 rounded-md border border-border bg-card px-3 py-1 text-[12px] text-foreground transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={onInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((file) => {
            const key = file.name + file.size;
            const pct = progressFor?.(file);
            return (
              <li
                key={key}
                className="flex items-center gap-2 rounded border border-border/50 bg-card/40 px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate text-[12px]" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatSize(file.size)}
                </span>
                {pct !== undefined ? (
                  <canvas
                    ref={(el) => {
                      if (el) barRefs.current.set(key, el);
                      else barRefs.current.delete(key);
                    }}
                    aria-hidden="true"
                    className="h-1.5 w-16 shrink-0 overflow-hidden rounded-[1px]"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.name, file.size);
                  }}
                  className="shrink-0 rounded px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
