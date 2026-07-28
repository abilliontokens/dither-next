"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { cn } from "./lib";

const CELL = 2;
const INDENT = 14; // css px per nesting level

export type TreeViewNode = {
  id: string;
  label: string;
  /** Optional right-aligned meta (count, tag). */
  badge?: string;
  /** Branch nodes have children; leaves omit them. */
  children?: TreeViewNode[];
  /** Disable selection + expansion on this node. */
  disabled?: boolean;
};

export interface DitherTreeViewProps {
  nodes: TreeViewNode[];
  /** Controlled expanded node ids. */
  expanded: string[];
  onExpandedChange?: (expanded: string[]) => void;
  /** Controlled selected node id (`null` = none). */
  selected: string | null;
  onSelectedChange?: (selected: string | null) => void;
  color?: PixelColor;
  seed?: number;
  className?: string;
}

// Dither language — one Bayer ramp per guide rail. The vertical rail fades
// downward (same recipe as DitherAccordion/DitherCollapsible); deeper rails
// read fainter so the eye lands on the top-level spine. `fade` (0..1) scales
// the whole rail so depth 0 is full-strength and each deeper level dims.
function paintRailV(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
  fade: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const h = canvas.offsetHeight;
  if (!ctx || h <= 0) return;
  const rows = Math.max(4, Math.round(h / CELL));
  canvas.width = 1;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, 1, rows);
  for (let y = 0; y < rows; y++) {
    const density = (1 - (y + 0.5) / rows) * fade;
    const lit = density > matrix[y & 3][0];
    const alpha = lit ? 0.28 * fade + 0.55 * density : 0.08 * density;
    if (alpha <= 0.004) continue;
    ctx.fillStyle = rgb(fill, 1, alpha);
    ctx.fillRect(0, y, 1, 1);
  }
}

// Selection accent — a short horizontal Bayer ramp densifying left→right, so
// the chosen row reads as a dithered marker rather than a solid highlight bar.
function paintAccentH(
  canvas: HTMLCanvasElement,
  color: PixelColor,
  matrix: number[][],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.offsetWidth;
  if (!ctx || w <= 0) return;
  const cols = Math.max(2, Math.round(w / CELL));
  canvas.width = cols;
  canvas.height = 1;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, cols, 1);
  for (let x = 0; x < cols; x++) {
    const density = (x + 0.5) / cols;
    const lit = density > matrix[0][x & 3];
    const alpha = lit ? 0.45 + 0.5 * density : 0.18 * density;
    if (alpha <= 0.004) continue;
    ctx.fillStyle = rgb(fill, 1, alpha);
    ctx.fillRect(x, 0, 1, 1);
  }
}

type FlatNode = { node: TreeViewNode; depth: number; parentId: string | null };

/** Walk the tree, descending only into expanded branches → the visible row
 *  order used for roving tabindex + arrow walking. */
function flattenVisible(
  nodes: TreeViewNode[],
  open: Set<string>,
  depth = 0,
  parentId: string | null = null,
  out: FlatNode[] = [],
): FlatNode[] {
  for (const node of nodes) {
    out.push({ node, depth, parentId });
    if (node.children?.length && open.has(node.id)) {
      flattenVisible(node.children, open, depth + 1, node.id, out);
    }
  }
  return out;
}

/**
 * DitherTreeView — a hierarchical tree (files/folders/nested nav) with a
 * dithered guide rail running down each nesting level and a dithered marker
 * on the selected row.
 *
 * Controlled: the parent owns `expanded`/`selected` and receives changes via
 * `onExpandedChange`/`onSelectedChange`. Full WAI-ARIA tree pattern:
 * `role="tree"` + recursive `role="treeitem"`/`role="group"`, `aria-expanded`,
 * `aria-level`, `aria-selected`, and roving tabindex (only the focused node
 * holds `tabindex=0`). Keyboard follows the APG tree pattern exactly:
 * ArrowUp/Down walk visible nodes, ArrowRight expands-or-descends, ArrowLeft
 * collapses-or-ascends, Home/End jump to the ends, Enter/Space selects (+toggles
 * a branch), `*` expands every sibling at the focused level.
 *
 * The guide rails are 1-backing-px canvases painted with the kit's vertical
 * Bayer ramp (same recipe as the accordion rail) — one per depth level, full
 * tree height, repainted on resize. SSR-safe: ids come from `useId()`, and
 * all canvas/observer work lives in effects.
 */
export function DitherTreeView({
  nodes,
  expanded,
  onExpandedChange,
  selected,
  onSelectedChange,
  color: colorProp,
  seed,
  className,
}: DitherTreeViewProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const open = useMemo(() => new Set(expanded), [expanded]);
  const flat = useMemo(() => flattenVisible(nodes, open), [nodes, open]);
  const maxDepth = useMemo(
    () => flat.reduce((m, f) => Math.max(m, f.depth), 0),
    [flat],
  );

  // Focus (roving tabindex) is internal state seeded from the controlled
  // selection; selection itself is parent-owned.
  const [focusedId, setFocusedId] = useState<string | null>(
    selected ?? nodes[0]?.id ?? null,
  );
  // Keep focus honest if the selection moves from the outside.
  useEffect(() => {
    if (selected && selected !== focusedId) setFocusedId(selected);
    // Intentionally only reacts to external selection changes.
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const railRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const accentRef = useRef<HTMLCanvasElement | null>(null);

  const reactId = useId();
  const idBase = `dk-tree-${reactId.replace(/:/g, "")}`;
  const groupIdOf = (id: string) => `${idBase}-group-${id}`;

  const focusNode = useCallback((id: string) => {
    setFocusedId(id);
    // Microtask so the roving tabindex commits before focus lands.
    queueMicrotask(() => buttonRefs.current.get(id)?.focus());
  }, []);

  const select = useCallback(
    (node: TreeViewNode) => {
      if (node.disabled) return;
      onSelectedChange?.(node.id);
      setFocusedId(node.id);
    },
    [onSelectedChange],
  );

  const toggle = useCallback(
    (id: string) => {
      onExpandedChange?.(
        open.has(id) ? expanded.filter((x) => x !== id) : [...expanded, id],
      );
    },
    [onExpandedChange, open, expanded],
  );

  const onKeydown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const idx = flat.findIndex((f) => f.node.id === focusedId);
      if (idx < 0) return;
      const f = flat[idx];
      const node = f.node;
      const hasKids = !!node.children?.length;
      const isOpen = open.has(node.id);
      switch (e.key) {
        case "ArrowDown":
          if (idx + 1 < flat.length) { e.preventDefault(); focusNode(flat[idx + 1].node.id); }
          break;
        case "ArrowUp":
          if (idx - 1 >= 0) { e.preventDefault(); focusNode(flat[idx - 1].node.id); }
          break;
        case "Home":
          e.preventDefault(); focusNode(flat[0].node.id);
          break;
        case "End":
          e.preventDefault(); focusNode(flat[flat.length - 1].node.id);
          break;
        case "ArrowRight":
          if (hasKids && !isOpen) { e.preventDefault(); toggle(node.id); }
          else if (isOpen && idx + 1 < flat.length) { e.preventDefault(); focusNode(flat[idx + 1].node.id); }
          break;
        case "ArrowLeft":
          if (isOpen) { e.preventDefault(); toggle(node.id); }
          else if (f.parentId) { e.preventDefault(); focusNode(f.parentId); }
          break;
        case "*": {
          // Expand every branch sharing the focused node's parent.
          e.preventDefault();
          const sibs = flat.filter((x) => x.parentId === f.parentId);
          const add = sibs
            .map((x) => x.node)
            .filter((n) => n.children?.length && !open.has(n.id))
            .map((n) => n.id);
          if (add.length) onExpandedChange?.([...expanded, ...add]);
          break;
        }
        case "Enter":
        case " ":
          e.preventDefault();
          select(node);
          if (hasKids) toggle(node.id);
          break;
      }
    },
    [flat, focusedId, open, expanded, toggle, focusNode, select, onExpandedChange],
  );

  // Paint the depth rails after mount, on structural/colour change, and on
  // resize. Rails are full-height vertical Bayer strips — one per level.
  useEffect(() => {
    let cleanupRo: ResizeObserver | null = null;
    const paint = () => {
      for (let i = 0; i < railRefs.current.length; i++) {
        const canvas = railRefs.current[i];
        if (canvas) paintRailV(canvas, color, matrix, Math.max(0.25, 1 - i * 0.18));
      }
      if (accentRef.current) paintAccentH(accentRef.current, color, matrix);
    };
    const raf = requestAnimationFrame(() => {
      paint();
      if (typeof ResizeObserver !== "undefined") {
        cleanupRo = new ResizeObserver(paint);
        for (const c of railRefs.current) if (c) cleanupRo.observe(c);
        if (accentRef.current) cleanupRo.observe(accentRef.current);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanupRo?.disconnect();
    };
  }, [color, matrix, maxDepth, expanded, nodes, selected]);

  const renderNode = (node: TreeViewNode, depth: number): ReactNode => {
    const hasKids = !!node.children?.length;
    const isOpen = open.has(node.id);
    const isSelected = node.id === selected;
    const isFocused = node.id === focusedId;
    return (
      <div
        key={node.id}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSelected}
        aria-expanded={hasKids ? isOpen : undefined}
        aria-disabled={node.disabled || undefined}
        aria-controls={hasKids ? groupIdOf(node.id) : undefined}
      >
        <div className="relative flex items-center gap-1">
          {isSelected && (
            <canvas
              ref={(el) => { accentRef.current = el; }}
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-[10px]"
              style={{ imageRendering: "pixelated" }}
            />
          )}
          <div
            className="flex flex-1 items-center gap-1"
            style={{ paddingLeft: `${depth * INDENT}px` }}
          >
            {hasKids ? (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                aria-label={isOpen ? "Collapse" : "Expand"}
                disabled={node.disabled}
                onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
                  isOpen ? "rotate-90" : "",
                )}
              >
                ›
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="inline-block size-4 shrink-0 text-center leading-4 text-muted-foreground/60"
              >
                ·
              </span>
            )}
            <button
              type="button"
              ref={(el) => {
                if (el) buttonRefs.current.set(node.id, el);
                else buttonRefs.current.delete(node.id);
              }}
              tabIndex={isFocused ? 0 : -1}
              disabled={node.disabled}
              onFocus={() => setFocusedId(node.id)}
              onClick={() => select(node)}
              onDoubleClick={() => hasKids && toggle(node.id)}
              className={cn(
                "flex flex-1 items-center justify-between gap-2 rounded-[2px] py-1 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                isSelected ? "text-foreground" : "text-foreground/80 hover:text-foreground",
                node.disabled && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="truncate">{node.label}</span>
              {node.badge !== undefined && (
                <span className="rounded border border-border/60 px-1 text-[10px] tabular-nums text-muted-foreground">
                  {node.badge}
                </span>
              )}
            </button>
          </div>
        </div>

        {hasKids && (
          <div
            id={groupIdOf(node.id)}
            role="group"
            inert={!isOpen}
            className="grid overflow-hidden transition-[grid-template-rows] duration-150 motion-reduce:transition-none"
            style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
          >
            <div>
              {node.children!.map((child) => renderNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="tree"
      aria-multiselectable="false"
      className={cn("relative font-mono text-[13px] text-foreground", className)}
      onKeyDown={onKeydown}
    >
      {/* Guide rails — one per indent gutter (depth 1..maxDepth), full
          height, behind the rows. Depth-0 roots have no guide. */}
      {Array.from({ length: maxDepth }, (_, i) => {
        const gutter = i + 1;
        return (
          <canvas
            key={`rail-${gutter}`}
            ref={(el) => { railRefs.current[i] = el; }}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-full w-[2px]"
            style={{
              left: `${gutter * INDENT - 4}px`,
              imageRendering: "pixelated",
            }}
          />
        );
      })}
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  );
}
