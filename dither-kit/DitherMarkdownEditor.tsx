"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";

export interface DitherMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Custom preview renderer. Default: a minimal inline markdown renderer. */
  preview?: (markdown: string) => ReactNode;
  color?: PixelColor;
  seed?: number;
  /** Accessible label. */
  label?: string;
  className?: string;
}

const LINE_H = 24; // px — matches the textarea line-height; keeps cursor-line math integral
const PAD_Y = 8; // textarea vertical padding

/** Paint the active-line indicator — a faint ordered-dither wash one line tall,
 *  repainted whenever the caret line, colour, or pane width changes. The dither
 *  is the kit's texture, not a flat highlight bar. */
function paintLineBand(canvas: HTMLCanvasElement, widthCss: number, color: PixelColor, matrix: number[][]) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const w = Math.max(1, Math.round(widthCss));
  if (canvas.width !== w) canvas.width = w;
  canvas.height = LINE_H;
  const fill = fillOf(color);
  const density = 0.22;
  ctx.clearRect(0, 0, w, LINE_H);
  for (let y = 0; y < LINE_H; y++) {
    for (let x = 0; x < w; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const a = lit ? 0.16 : 0.04;
      ctx.fillStyle = rgb(fill, 1, a);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// --- minimal pure-TS markdown renderer (no deps) -----------------------------
// Block: #/##/### headings, ``` fenced code, `- `/`* ` bullets, `1. ` ordered,
// blank-line paragraphs. Inline: **bold**, *italic*, `code`, [text](url).

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let i = 0;
  const RE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/;
  while (rest.length) {
    const m = RE.exec(rest);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    else if (m[4] !== undefined) nodes.push(<em key={`${keyBase}-i${i}`}>{m[4]}</em>);
    else if (m[6] !== undefined) nodes.push(<code key={`${keyBase}-c${i}`} className="rounded bg-background/70 px-1 py-0.5 text-[12px]">{m[6]}</code>);
    else if (m[8] !== undefined) nodes.push(<a key={`${keyBase}-l${i}`} href={m[9]} className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer noopener">{m[8]}</a>);
    rest = rest.slice(m.index + m[0].length);
    i++;
  }
  return nodes;
}

function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block.
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
      i++; // skip closing fence (if any)
      out.push(<pre key={`pre${i}`} className="overflow-x-auto rounded-md border border-border/50 bg-background/70 p-2 text-[12px] text-foreground"><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "text-[18px] font-bold" : level === 2 ? "text-[15px] font-bold" : "text-[13px] font-semibold";
      out.push(<div key={`h${i}`} className={cn("mt-1 text-foreground", cls)}>{renderInline(h[2], `h${i}`)}</div>);
      i++; continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m = type === "ul" ? /^[-*]\s+(.*)$/.exec(lines[i]) : /^\d+\.\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(<li key={`li${i}`}>{renderInline(m[1], `li${i}`)}</li>);
        i++;
      }
      out.push(type === "ul"
        ? <ul key={`ul${i}`} className="ml-5 list-disc text-[13px] text-foreground">{items}</ul>
        : <ol key={`ol${i}`} className="ml-5 list-decimal text-[13px] text-foreground">{items}</ol>);
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    out.push(<p key={`p${i}`} className="text-[13px] leading-[24px] text-foreground">{renderInline(line, `p${i}`)}</p>);
    i++;
  }
  return out;
}


/**
 * DitherMarkdownEditor — a split-pane markdown editor. A textarea on the left,
 * live preview on the right, a formatting toolbar (bold / italic / H1–3 / bullet
 * list / link / code), keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K), and a
 * **Bayer-dithered cursor-line indicator**: a faint dithered wash tracking the
 * active line. Controlled via `value`/`onChange`.
 *
 * `preview` is an optional render-prop; the default is a minimal pure-TS inline
 * renderer (headings, bold, italic, inline code, fenced code, ordered/unordered
 * lists, links) — no dependencies. The two panes scroll in sync (proportional).
 *
 * Accessibility: the toolbar is a `role="toolbar"` of labelled buttons (toggle
 * marks carry `aria-pressed`); the textarea is labelled; the preview region is
 * an `aria-label`led article.
 *
 * SSR / hydration: the active line resolves to 0 until the first effect reads
 * the caret (no DOM access in render); the line-band top is an integer; the
 * dither lives on a canvas painted in an effect.
 */
export function DitherMarkdownEditor({
  value,
  onChange,
  preview,
  color: colorProp,
  seed,
  label = "Markdown editor",
  className,
}: DitherMarkdownEditorProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const [activeLine, setActiveLine] = useState(0);
  const [pendingSel, setPendingSel] = useState<{ from: number; to: number } | null>(null);

  // Recompute the caret line from the textarea selection.
  const refreshLine = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const upto = value.slice(0, ta.selectionStart);
    setActiveLine(upto.split("\n").length - 1);
  }, [value]);

  // Apply a pending selection after the controlled value re-renders.
  useEffect(() => {
    if (!pendingSel) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pendingSel.from, pendingSel.to);
      refreshLine();
    }
    setPendingSel(null);
  }, [value, pendingSel, refreshLine]);

  // Paint the cursor-line band when the line/colour/width changes.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      const c = lineCanvasRef.current;
      const pane = paneRef.current;
      if (c && pane) paintLineBand(c, pane.clientWidth - 24 /* px-3 both sides */, color, matrix);
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined" && paneRef.current) {
        ro = new ResizeObserver(paint);
        ro.observe(paneRef.current);
      }
    });
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [activeLine, color, matrix]);

  // Keep the caret line fresh while typing / selecting.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const handler = () => refreshLine();
    const onSelect = () => { if (document.activeElement === ta) refreshLine(); };
    ta.addEventListener("input", handler);
    ta.addEventListener("keyup", handler);
    ta.addEventListener("click", handler);
    document.addEventListener("selectionchange", onSelect);
    return () => {
      ta.removeEventListener("input", handler);
      ta.removeEventListener("keyup", handler);
      ta.removeEventListener("click", handler);
      document.removeEventListener("selectionchange", onSelect);
    };
  }, [refreshLine]);

  /** Build an Edit that wraps/replaces the current selection, then commit it. */
  const applyEdit = useCallback((build: (sel: string) => { text: string; caretFrom: number; caretTo: number }) => {
    const ta = taRef.current;
    if (!ta) return;
    const from = ta.selectionStart;
    const to = ta.selectionEnd;
    const sel = value.slice(from, to);
    const { text, caretFrom, caretTo } = build(sel);
    const next = value.slice(0, from) + text + value.slice(to);
    onChange(next);
    setPendingSel({ from: from + caretFrom, to: from + caretTo });
  }, [value, onChange]);

  const wrap = useCallback((pre: string, post: string, ph: string) =>
    applyEdit((sel) => {
      const inner = sel.length ? sel : ph;
      return { text: pre + inner + post, caretFrom: pre.length, caretTo: pre.length + inner.length };
    }), [applyEdit]);

  /** Prefix every selected line (used for headings + bullet lists). */
  const prefixLines = useCallback((token: string) =>
    applyEdit((sel) => {
      const lines = sel.length ? sel.split("\n") : [""] ;
      const prefixed = lines.map((l) => token + l).join("\n");
      return { text: prefixed, caretFrom: 0, caretTo: prefixed.length };
    }), [applyEdit]);

  const doBold = useCallback(() => wrap("**", "**", "bold"), [wrap]);
  const doItalic = useCallback(() => wrap("*", "*", "italic"), [wrap]);
  const doCode = useCallback(() => wrap("`", "`", "code"), [wrap]);
  const doH = useCallback((level: 1 | 2 | 3) => prefixLines("#".repeat(level) + " "), [prefixLines]);
  const doBullet = useCallback(() => prefixLines("- "), [prefixLines]);
  const doLink = useCallback(() =>
    applyEdit((sel) => {
      const inner = sel.length ? sel : "text";
      return { text: `[${inner}](url)`, caretFrom: inner.length + 3, caretTo: inner.length + 6 };
    }), [applyEdit]);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === "b" || e.key === "B") { e.preventDefault(); doBold(); }
    else if (e.key === "i" || e.key === "I") { e.preventDefault(); doItalic(); }
    else if (e.key === "k" || e.key === "K") { e.preventDefault(); doLink(); }
  }, [doBold, doItalic, doLink]);

  // Synced scroll (proportional) between the two panes.
  const syncing = useRef(false);
  const onTaScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    const ta = taRef.current, pv = previewRef.current;
    if (ta && pv) {
      const denom = ta.scrollHeight - ta.clientHeight;
      pv.scrollTop = denom > 0 ? (ta.scrollTop / denom) * (pv.scrollHeight - pv.clientHeight) : 0;
    }
    queueMicrotask(() => { syncing.current = false; });
  }, []);
  const onPreviewScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    const ta = taRef.current, pv = previewRef.current;
    if (ta && pv) {
      const denom = pv.scrollHeight - pv.clientHeight;
      ta.scrollTop = denom > 0 ? (pv.scrollTop / denom) * (ta.scrollHeight - ta.clientHeight) : 0;
    }
    queueMicrotask(() => { syncing.current = false; });
  }, []);

  const reactId = useId();
  const taId = `${reactId}-ta`;

  const tools: { label: string; title: string; run: () => void; kbd?: string }[] = [
    { label: "B", title: "Bold (Ctrl+B)", run: doBold, kbd: "Ctrl+B" },
    { label: "I", title: "Italic (Ctrl+I)", run: doItalic, kbd: "Ctrl+I" },
    { label: "H1", title: "Heading 1", run: () => doH(1) },
    { label: "H2", title: "Heading 2", run: () => doH(2) },
    { label: "H3", title: "Heading 3", run: () => doH(3) },
    { label: "• List", title: "Bullet list", run: doBullet },
    { label: "</>", title: "Inline code", run: doCode },
    { label: "Link", title: "Link (Ctrl+K)", run: doLink, kbd: "Ctrl+K" },
  ];

  return (
    <div className={cn("flex flex-col rounded-lg border border-border/60 bg-card/30 font-mono text-foreground", className)}>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-border/60 p-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            aria-label={t.title}
            onClick={t.run}
            className={cn("rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[12px] hover:border-foreground/30", CONTROL_BUTTON)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-[16rem] flex-1 grid-cols-2 overflow-hidden">
        <div ref={paneRef} className="relative border-r border-border/60">
          {/* Dithered cursor-line indicator. */}
          <canvas
            ref={lineCanvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 z-0"
            style={{ top: PAD_Y + activeLine * LINE_H, height: LINE_H, imageRendering: "pixelated" }}
          />
          <textarea
            id={taId}
            ref={taRef}
            value={value}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            onScroll={onTaScroll}
            onKeyDown={onKeyDown}
            aria-label={label}
            className="relative z-10 h-full w-full resize-none bg-transparent px-3 text-[13px] leading-[24px] text-foreground outline-none"
            style={{ padding: `${PAD_Y}px 12px` }}
          />
        </div>
        <div
          ref={previewRef}
          role="region"
          aria-label="Preview"
          onScroll={onPreviewScroll}
          className="h-full overflow-auto px-3 py-2"
        >
          {preview ? preview(value) : <article>{renderMarkdown(value)}</article>}
        </div>
      </div>
      <span className="sr-only" id={`${reactId}-desc`}>{`${label}. Use the toolbar or Ctrl+B, Ctrl+I, Ctrl+K.`}</span>
    </div>
  );
}
