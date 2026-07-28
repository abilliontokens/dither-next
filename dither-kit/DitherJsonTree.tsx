"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb, cssColor, type DitherColor } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";

const INDENT = 14;

// --- JSON model ------------------------------------------------------------

type Kind = "null" | "boolean" | "number" | "string" | "array" | "object";

function kindOf(v: unknown): Kind {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "boolean") return "boolean";
  if (t === "number") return "number";
  if (t === "string") return "string";
  return "object";
}

type JNode = {
  path: string;
  key: string;
  depth: number;
  kind: Kind;
  isContainer: boolean;
  preview: string;
  childCount: number;
  children: JNode[];
};

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Build a dot/bracket path a developer can paste back into code: bare keys
 *  use `.key`, non-identifier keys use `["..."]`, array indices use `[i]`. */
function childPath(parent: string, key: string): string {
  if (parent === "") return IDENT.test(key) ? key : `[${JSON.stringify(key)}]`;
  return IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

function primitivePreview(value: unknown, kind: Kind): string {
  if (kind === "string") return JSON.stringify(value as string);
  if (kind === "null") return "null";
  return String(value);
}

function buildNode(value: unknown, key: string, path: string, depth: number): JNode {
  const kind = kindOf(value);
  if (kind === "array") {
    const arr = value as unknown[];
    const children = arr.map((v, i) => buildNode(v, String(i), `${path}[${i}]`, depth + 1));
    return {
      path, key, depth, kind, isContainer: true,
      preview: `[ …${arr.length} ]`, childCount: arr.length, children,
    };
  }
  if (kind === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const children = entries.map(([k, v]) => buildNode(v, k, childPath(path, k), depth + 1));
    return {
      path, key, depth, kind, isContainer: true,
      preview: `{ …${entries.length} }`, childCount: entries.length, children,
    };
  }
  return {
    path, key, depth, kind, isContainer: false,
    preview: primitivePreview(value, kind), childCount: 0, children: [],
  };
}

type Flat = { node: JNode; parentId: string | null };

function flatten(
  nodes: JNode[],
  expanded: Set<string>,
  out: Flat[] = [],
  parentId: string | null = null,
): Flat[] {
  for (const node of nodes) {
    out.push({ node, parentId });
    if (node.isContainer && expanded.has(node.path)) {
      flatten(node.children, expanded, out, node.path);
    }
  }
  return out;
}

function defaultExpanded(root: JNode, depth: number): Set<string> {
  const out = new Set<string>();
  const walk = (node: JNode) => {
    if (node.isContainer && node.depth < depth) {
      out.add(node.path);
      for (const c of node.children) walk(c);
    }
  };
  walk(root);
  return out;
}

function collectContainerPaths(node: JNode, out: string[] = []): string[] {
  if (node.isContainer) out.push(node.path);
  for (const c of node.children) collectContainerPaths(c, out);
  return out;
}

// --- type chips (Bayer tiles) ----------------------------------------------

/** Semantic colour + dither density per JSON type — the chip's Bayer field is
 *  the kit's texture, not a flat swatch. */
const CHIP: Record<Kind, { color: DitherColor; density: number }> = {
  null: { color: "grey", density: 0.25 },
  boolean: { color: "purple", density: 0.6 },
  number: { color: "blue", density: 0.7 },
  string: { color: "green", density: 0.82 },
  array: { color: "orange", density: 0.5 },
  object: { color: "pink", density: 0.9 },
};

function paintChip(kind: Kind, matrix: number[][]): string | null {
  if (typeof document === "undefined") return null;
  const { color, density } = CHIP[kind];
  const fill = fillOf(color);
  const canvas = document.createElement("canvas");
  canvas.width = 5;
  canvas.height = 5;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const lit = density > matrix[y & 3][x & 3];
      const alpha = lit ? 0.92 : 0.12;
      ctx.fillStyle = rgb(fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

const VALUE_CLASS: Record<Kind, string> = {
  null: "text-muted-foreground/70 italic",
  boolean: "text-purple-400",
  number: "text-blue-400",
  string: "text-emerald-400",
  array: "text-orange-400",
  object: "text-pink-400",
};

// --- component -------------------------------------------------------------

export interface DitherJsonTreeProps {
  /** Any JSON-serialisable value. */
  data: unknown;
  /** Expand containers down to this depth on first render (default 1). */
  defaultExpandDepth?: number;
  /** Show the expand-all / collapse-all toolbar (default true). */
  toolbar?: boolean;
  color?: PixelColor;
  seed?: number;
  /** Accessible label for the tree (default "JSON tree"). */
  label?: string;
  className?: string;
}

/**
 * DitherJsonTree — a collapsible JSON inspector. Each value renders with a
 * small **Bayer-dithered type chip** (six kinds: string/number/boolean/null/
 * array/object) whose density + hue identify the type at a glance; collapsed
 * containers show an inline preview (`{ …3 }`, `[ …7 ]`).
 *
 * Distinct from `DitherTreeView` (a generic nav tree): this one is value-typed
 * and fully data-driven — the tree shape, keys, and previews all derive from
 * the `data` prop, and each row knows its JSON type.
 *
 * Copy-path: the row button copies the value's JSON path (`users[0].name`,
 * `$` for the root) — Enter/Space on a primitive does the same; on a container
 * it toggles. Expand-all / collapse-all reset every container at once.
 *
 * Accessibility: full WAI-ARIA tree (`role="tree"` + recursive
 * `role="treeitem"`, `aria-level`, `aria-expanded`) with roving tabindex.
 * Arrows walk visible rows, Left/Right collapse-or-ascend / expand-or-descend,
 * Home/End jump to the ends, Enter/Space activates the row.
 *
 * SSR-safe: chips are baked in an effect (canvas only in the browser); no
 * `Math.random` or `Date.now` in render.
 */
export function DitherJsonTree({
  data,
  defaultExpandDepth = 1,
  toolbar = true,
  color: colorProp,
  seed,
  label = "JSON tree",
  className,
}: DitherJsonTreeProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const root = useMemo(() => buildNode(data, "(root)", "", 0), [data]);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpanded(root, defaultExpandDepth),
  );
  useEffect(() => {
    setExpanded(defaultExpanded(root, defaultExpandDepth));
  }, [root, defaultExpandDepth]);

  const flat = useMemo(() => flatten([root], expanded), [root, expanded]);

  // Focus (roving tabindex) is internal state seeded from the first row.
  const [focusedPath, setFocusedPath] = useState<string>(root.path);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Type-chip tiles: one Bayer tile per kind, baked once (re-baked on reseed).
  const [chips, setChips] = useState<Record<Kind, string | null>>({
    null: null, boolean: null, number: null, string: null, array: null, object: null,
  });
  useEffect(() => {
    setChips({
      null: paintChip("null", matrix),
      boolean: paintChip("boolean", matrix),
      number: paintChip("number", matrix),
      string: paintChip("string", matrix),
      array: paintChip("array", matrix),
      object: paintChip("object", matrix),
    });
  }, [matrix]);

  const copyTimer = useRef<number>(0);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyPath = useCallback((path: string) => {
    const text = path === "" ? "$" : path;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopied(path);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(null), 1400);
      }
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — no-op.
    }
  }, []);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const focusPath = useCallback((path: string) => {
    setFocusedPath(path);
    queueMicrotask(() => buttonRefs.current.get(path)?.focus());
  }, []);

  const onKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const idx = flat.findIndex((f) => f.node.path === focusedPath);
      if (idx < 0) return;
      const f = flat[idx];
      const node = f.node;
      const isOpen = node.isContainer && expanded.has(node.path);
      switch (e.key) {
        case "ArrowDown":
          if (idx + 1 < flat.length) { e.preventDefault(); focusPath(flat[idx + 1].node.path); }
          break;
        case "ArrowUp":
          if (idx - 1 >= 0) { e.preventDefault(); focusPath(flat[idx - 1].node.path); }
          break;
        case "Home":
          e.preventDefault(); focusPath(flat[0].node.path);
          break;
        case "End":
          e.preventDefault(); focusPath(flat[flat.length - 1].node.path);
          break;
        case "ArrowRight":
          if (node.isContainer && !isOpen) { e.preventDefault(); toggle(node.path); }
          else if (isOpen && idx + 1 < flat.length) { e.preventDefault(); focusPath(flat[idx + 1].node.path); }
          break;
        case "ArrowLeft":
          if (isOpen) { e.preventDefault(); toggle(node.path); }
          else if (f.parentId) { e.preventDefault(); focusPath(f.parentId); }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (node.isContainer) toggle(node.path);
          else copyPath(node.path);
          break;
      }
    },
    [flat, focusedPath, expanded, toggle, focusPath, copyPath],
  );

  const chipStyle = (kind: Kind): CSSProperties | undefined => {
    const url = chips[kind];
    if (!url) return undefined;
    return { backgroundImage: `url(${url})`, backgroundSize: "10px 10px" };
  };

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card/40", className)}>
      {toolbar && (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            JSON
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded(new Set(collectContainerPaths(root)))}
              className={cn(
                CONTROL_BUTTON,
                "rounded border border-border/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground",
              )}
            >
              expand all
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              className={cn(
                CONTROL_BUTTON,
                "rounded border border-border/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground",
              )}
            >
              collapse all
            </button>
          </div>
        </div>
      )}

      <div
        role="tree"
        aria-label={label}
        onKeyDown={onKeydown}
        className="overflow-auto p-1 font-mono text-[12px] text-foreground"
      >
        {flat.map(({ node }) => {
          const isOpen = node.isContainer && expanded.has(node.path);
          const isFocused = node.path === focusedPath;
          const isCopied = copied === node.path;
          return (
            <div
              key={node.path || "(root)"}
              role="treeitem"
              aria-level={node.depth + 1}
              aria-expanded={node.isContainer ? isOpen : undefined}
            >
              <div
                className="flex items-center gap-1.5 rounded-[2px] py-0.5 pr-1"
                style={{ paddingLeft: `${node.depth * INDENT}px` }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block w-3 shrink-0 text-center text-muted-foreground/70",
                    node.isContainer ? "cursor-pointer" : "opacity-0",
                  )}
                >
                  {node.isContainer ? (isOpen ? "▾" : "▸") : ""}
                </span>
                <span
                  aria-hidden="true"
                  className="size-[10px] shrink-0 rounded-[1px] ring-1 ring-inset ring-border/40"
                  style={chipStyle(node.kind)}
                />
                <button
                  type="button"
                  ref={(el) => {
                    if (el) buttonRefs.current.set(node.path, el);
                    else buttonRefs.current.delete(node.path);
                  }}
                  tabIndex={isFocused ? 0 : -1}
                  title={node.isContainer ? "Toggle" : "Copy path"}
                  onFocus={() => setFocusedPath(node.path)}
                  onClick={() => (node.isContainer ? toggle(node.path) : copyPath(node.path))}
                  className={cn(
                    "flex flex-1 items-center gap-1.5 truncate text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                    isFocused ? "text-foreground" : "text-foreground/85 hover:text-foreground",
                  )}
                  style={isFocused ? { color: cssColor(color) } : undefined}
                >
                  {node.depth > 0 && (
                    <span className="text-muted-foreground">
                      {node.kind === "array" ? node.key : `"${node.key}"`}
                      <span className="px-0.5 text-muted-foreground/50">:</span>
                    </span>
                  )}
                  {node.isContainer ? (
                    <span className={cn(VALUE_CLASS[node.kind], !isOpen && "text-muted-foreground")}>
                      {node.preview}
                    </span>
                  ) : (
                    <span className={cn("truncate", VALUE_CLASS[node.kind])}>
                      {node.preview}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isCopied ? "Path copied" : "Copy path"}
                  onClick={() => copyPath(node.path)}
                  className={cn(
                    CONTROL_BUTTON,
                    "shrink-0 rounded px-1 font-mono text-[11px] text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  {isCopied ? "✓" : "⧉"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
