"use client";

import { useMemo, type ComponentType, type ElementType, type ReactNode } from "react";

import { DitherCodeBlock } from "./DitherCodeBlock";
import { cn } from "./lib";

// --- inline patterns ---------------------------------------------------------
// Global regexes scanned left-to-right; the order is the tie-break priority
// (code is extracted whole so formatting inside it is protected; image before
// link because `![` shares `[`; bold before italic because `**` shares `*`).
const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "code", re: /`([^`]+)`/g },
  { kind: "img", re: /!\[([^\]]*)\]\(([^)\s]+)\)/g },
  { kind: "link", re: /\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g },
  { kind: "bold", re: /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/g },
  { kind: "italic", re: /\*(?!\s)([\s\S]+?)\*|_(?!\s)([\s\S]+?)_/g },
];

/** Parse a run of inline markdown to React nodes. Recursive for bold/italic/link. */
function parseInline(
  text: string,
  components: MarkdownComponents,
  keyPrefix: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  const Code = components.code ?? "code";
  const Strong = components.strong ?? "strong";
  const Em = components.em ?? "em";
  const A = components.a ?? "a";
  const Img = components.img ?? "img";
  let pos = 0;
  let keyIdx = 0;
  const key = (): string => `${keyPrefix}-${keyIdx++}`;
  while (pos < text.length) {
    let bestIdx = -1;
    let bestKind = "";
    let bestEnd = 0;
    let bestM: RegExpExecArray | null = null;
    for (const p of PATTERNS) {
      p.re.lastIndex = pos;
      const m = p.re.exec(text);
      if (m && m.index >= pos && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestKind = p.kind;
        bestEnd = m.index + m[0].length;
        bestM = m;
      }
    }
    if (bestIdx === -1 || !bestM) {
      out.push(text.slice(pos));
      break;
    }
    if (bestIdx > pos) out.push(text.slice(pos, bestIdx));
    const m = bestM;
    if (bestKind === "code") {
      out.push(<Code key={key()}>{m[1]}</Code>);
    } else if (bestKind === "img") {
      out.push(<Img key={key()} src={m[2]} alt={m[1]} />);
    } else if (bestKind === "link") {
      const href = m[2];
      const external = /^https?:\/\//i.test(href);
      out.push(
        <A
          key={key()}
          href={href}
          title={m[3]}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {parseInline(m[1], components, key())}
        </A>,
      );
    } else if (bestKind === "bold") {
      out.push(<Strong key={key()}>{parseInline(m[1] ?? m[2] ?? "", components, key())}</Strong>);
    } else if (bestKind === "italic") {
      out.push(<Em key={key()}>{parseInline(m[1] ?? m[2] ?? "", components, key())}</Em>);
    }
    pos = bestEnd;
  }
  return out;
}

// --- block tokenizer ---------------------------------------------------------
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "para"; text: string }
  | { type: "code"; text: string; lang: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" };

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^(\s*[-*_]){3,}\s*$/.test(line)
  );
}

/** Parse block-level markdown. One level of list nesting; no setext/tables. */
function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const lang = fence[1].trim();
      const buf: string[] = [];
      i++;
      while (i < n && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume the closing fence (or EOF)
      blocks.push({ type: "code", text: buf.join("\n"), lang });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)(?:\s+#+)?$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < n && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < n && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < n && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const buf: string[] = [];
    while (i < n && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "para", text: buf.join(" ") });
  }
  return blocks;
}


function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

export type MarkdownComponents = Partial<
  Record<
    "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "a" | "ul" | "ol" | "li" | "blockquote" | "hr" | "code" | "strong" | "em" | "img",
    ElementType
  >
> & {
  /** Override the fenced-code renderer (defaults to `DitherCodeBlock`). */
  codeBlock?: ComponentType<{ code: string; language?: string }>;
};

export interface DitherMarkdownRenderProps {
  /** Markdown source. Falls back to `children` when this is omitted. */
  source?: string;
  /** Override the element types used for each construct. */
  components?: MarkdownComponents;
  className?: string;
  /** Markdown source passed as children (when `source` is omitted). */
  children?: string;
}

/** Resolve a heading override by level without dynamic-key indexing. */
function headingTag(components: MarkdownComponents, level: number): ElementType {
  switch (level) {
    case 1:
      return components.h1 ?? "h1";
    case 2:
      return components.h2 ?? "h2";
    case 3:
      return components.h3 ?? "h3";
    case 4:
      return components.h4 ?? "h4";
    case 5:
      return components.h5 ?? "h5";
    default:
      return components.h6 ?? "h6";
  }
}

/**
 * DitherMarkdownRender — a pure-TypeScript markdown→React renderer (no parser
 * dependency). Supports headings (with slug anchor ids for `DitherOutline`
 * integration), paragraphs, bold/italic, inline code, links, images, ordered and
 * unordered lists, blockquotes, and horizontal rules. Fenced code blocks compose
 * `DitherCodeBlock`, so they inherit the kit's Bayer-dithered line-number gutter
 * — the component's dither element — rather than re-implementing it.
 *
 * `aria-valuetext`-style determinism: heading ids are derived from the heading
 * text with a per-render duplicate counter, so the same source always produces
 * the same ids on server and client (no hydration mismatch). A `components` prop
 * overrides any element type; the code-block renderer is overridable separately
 * via `components.codeBlock`.
 *
 * Scope: one level of list nesting; no tables/setext/reference-links/HTML. The
 * inline parser protects code spans (extracted whole) and orders ties so `**`
 * wins over `*` and `![` wins over `[`.
 */
export function DitherMarkdownRender({
  source,
  components = {},
  className,
  children,
}: DitherMarkdownRenderProps) {
  const src = source ?? (typeof children === "string" ? children : "");
  const blocks = useMemo(() => parseBlocks(src), [src]);

  // Per-render duplicate-id counter — deterministic for a given source.
  const idCounts = new Map<string, number>();
  function headingId(text: string): string {
    const base = slugify(text);
    const c = idCounts.get(base) ?? 0;
    idCounts.set(base, c + 1);
    return c === 0 ? base : `${base}-${c}`;
  }

  const P = components.p ?? "p";
  const Ul = components.ul ?? "ul";
  const Ol = components.ol ?? "ol";
  const Li = components.li ?? "li";
  const Blockquote = components.blockquote ?? "blockquote";
  const Hr = components.hr ?? "hr";
  const CodeBlock = components.codeBlock ?? DitherCodeBlock;

  return (
    <div className={cn("text-foreground", className)}>
      {blocks.map((b, idx) => {
        const kp = `md-${idx}`;
        switch (b.type) {
          case "heading": {
            const H = headingTag(components, b.level);
            const id = headingId(b.text);
            return (
              <H key={idx} id={id}>
                {parseInline(b.text, components, kp)}
              </H>
            );
          }
          case "para":
            return <P key={idx}>{parseInline(b.text, components, kp)}</P>;
          case "code":
            return <CodeBlock key={idx} code={b.text} language={b.lang || undefined} />;
          case "ul":
            return (
              <Ul key={idx}>
                {b.items.map((it, i) => (
                  <Li key={i}>{parseInline(it, components, `${kp}-${i}`)}</Li>
                ))}
              </Ul>
            );
          case "ol":
            return (
              <Ol key={idx}>
                {b.items.map((it, i) => (
                  <Li key={i}>{parseInline(it, components, `${kp}-${i}`)}</Li>
                ))}
              </Ol>
            );
          case "quote":
            return <Blockquote key={idx}>{parseInline(b.text, components, kp)}</Blockquote>;
          case "hr":
            return <Hr key={idx} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
