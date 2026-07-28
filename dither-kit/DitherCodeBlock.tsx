"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb, type Rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;

/** Paint a gutter tile (gutter width × one line height) as a faint muted Bayer
 *  wash and return its data URL. Tiled one-per-line down the gutter, it gives
 *  the line-number column the kit's texture without obscuring the digits. */
function paintGutterTile(w: number, h: number, matrix: number[][]): string | null {
  if (typeof document === "undefined" || w <= 0 || h <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w / CELL));
  canvas.height = Math.max(2, Math.round(h / CELL));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const muted = fillOf("grey") as Rgb;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const lit = 0.3 > matrix[y & 3][x & 3];
      const alpha = lit ? 0.18 : 0.05;
      if (alpha <= 0.004) continue;
      ctx.fillStyle = rgb(muted, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

export interface DitherCodeBlockProps {
  /** The source text. */
  code: string;
  /** Language label only (no highlighting is performed). */
  language?: string;
  /** Filename tab; when set, a header bar renders with the copy button. */
  filename?: string;
  /** Render the line-number gutter (default on). */
  showLineNumbers?: boolean;
  /** Scroll-body max height (any CSS length). */
  maxHeight?: number | string;
  /** Accessible label; defaults to the filename or "Code". */
  label?: string;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Replace the whole body (e.g. a custom renderer). */
  children?: ReactNode;
}

/**
 * DitherCodeBlock — a monospace code display with a dithered line-number
 * gutter, an optional filename tab, and a copy button. No syntax-highlighting
 * dependency: the source renders as plain monospace text, and the gutter reads
 * with the kit's ordered-dither texture (a tiled muted Bayer wash) rather than
 * a flat tint.
 *
 * Copy uses `navigator.clipboard` in a click handler with a transient "Copied"
 * confirmation (guarding environments where the API is unavailable). Lines
 * never wrap (`white-space: pre`) so each line-number aligns to exactly one
 * source line.
 *
 * Accessibility: `role="region"` with an `aria-label`; the code lives in a
 * `<pre><code>`; the copy button announces its state via `aria-label`. The
 * gutter is `aria-hidden` decoration.
 *
 * SSR-safe: the gutter tile is painted in an effect (canvas only in the
 * browser) and re-measured on resize; ids from `useId()`.
 */
export function DitherCodeBlock({
  code,
  language,
  filename,
  showLineNumbers = true,
  maxHeight,
  label,
  color: colorProp,
  seed,
  className,
  children,
}: DitherCodeBlockProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color = useMemo<PixelColor>(() => colorProp ?? s?.hue ?? "blue", [colorProp, s]);
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed],
  );

  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const gutterDigitCount = String(lines.length).length;

  const regionRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const copyTimer = useRef<number>(0);
  const [copied, setCopied] = useState(false);
  const [gutter, setGutter] = useState<{ url: string; w: number; h: number } | null>(null);

  const reactId = useId();
  const regionLabel = label ?? filename ?? "Code";

  // Measure the rendered gutter cell + paint the wash tile; re-measure on
  // resize so the tile stays aligned to the actual line height.
  useEffect(() => {
    if (!showLineNumbers) {
      setGutter(null);
      return;
    }
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const node = measureRef.current;
      if (!node) return;
      const w = Math.ceil(node.offsetWidth);
      const h = Math.ceil(node.offsetHeight);
      if (w <= 0 || h <= 0) return;
      const url = paintGutterTile(w, h, matrix);
      if (url) setGutter({ url, w, h });
    };
    const raf = requestAnimationFrame(() => {
      measure();
      if (typeof ResizeObserver !== "undefined" && regionRef.current) {
        ro = new ResizeObserver(measure);
        ro.observe(regionRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [showLineNumbers, matrix, lines.length, color]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — no-op.
    }
  };

  const gutterStyle = useMemo<CSSProperties | undefined>(
    () =>
      gutter
        ? {
            backgroundImage: `url(${gutter.url})`,
            backgroundSize: `${gutter.w}px ${gutter.h}px`,
            backgroundRepeat: "repeat",
          }
        : undefined,
    [gutter],
  );

  const bodyStyle = useMemo<CSSProperties>(
    () => ({ maxHeight: maxHeight === undefined ? undefined : typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }),
    [maxHeight],
  );

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label={regionLabel}
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card/40 font-mono text-[12px] text-foreground",
        className,
      )}
    >
      {filename ? (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-card/60 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-muted-foreground">›</span>
            <span className="truncate text-[12px] text-foreground">{filename}</span>
            {language ? (
              <span className="rounded border border-border/60 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {language}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy code"}
            className={cn(
              "shrink-0 rounded border border-border/60 px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
              copied ? "text-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      ) : null}

      <div className="relative">
        <pre
          id={`${reactId}-pre`}
          className="overflow-auto leading-relaxed"
          style={bodyStyle}
        >
          <code className="block">
            {children ??
              lines.map((line, i) => (
                <span key={i} className="flex">
                  {showLineNumbers ? (
                    <span
                      ref={i === 0 ? measureRef : undefined}
                      aria-hidden="true"
                      className="shrink-0 select-none pr-3 pl-3 text-right tabular-nums text-muted-foreground"
                      style={{
                        minWidth: `${Math.max(2, gutterDigitCount) + 1}ch`,
                        ...gutterStyle,
                      }}
                    >
                      {i + 1}
                    </span>
                  ) : null}
                  <span className="flex-1 whitespace-pre pr-3 pl-3">{line || " "}</span>
                </span>
              ))}
          </code>
        </pre>

        {!filename ? (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy code"}
            className={cn(
              "absolute right-2 top-2 rounded border border-border/60 bg-card/80 px-2 py-0.5 text-[11px] backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
              copied ? "text-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {copied ? "copied" : "copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
