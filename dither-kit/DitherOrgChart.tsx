"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  BAYER4,
  fillOf,
  pixelMatrixFromSeed,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { project, rubberband, velocityFrom } from "./gesture";
import { rgb } from "./palette";
import { useCanvasVisibility } from "./use-visibility";
import { cn, px, round } from "./lib";

const NODE_W = 150;
const NODE_H = 46;
const LEVEL_H = 104; // vertical gap between depth levels
const UNIT_W = NODE_W; // horizontal leaf unit
const SIBLING_GAP = 36;
const ROOT_GAP = 64;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// --- dithered bezier stroke (verbatim recipe from DitherFlow) ----------------

type Pt = [number, number];

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Stamp a dithered disc: a pixel lights only when `density` clears its Bayer
 *  threshold — no antialiasing, pure ordered dither. Overlapping stamps along a
 *  densely-sampled bezier form a continuous crisp dithered stroke. */
function stampDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  density: number,
  matrix: number[][],
  fill: string,
): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (density > matrix[(cy + dy) & 3][(cx + dx) & 3]) {
        ctx.fillStyle = fill;
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
}

export interface DitherOrgNode {
  id: string;
  label: string;
  /** Parent id. Omit, or point at an unknown id, to make this a root. */
  parentId?: string;
}

export interface DitherOrgChartProps {
  nodes: DitherOrgNode[];
  /** Controlled focused (active) node id. Omit for uncontrolled. */
  focusId?: string | null;
  onFocusChange?: (id: string | null) => void;
  color?: PixelColor;
  seed?: number;
  /** Accessible label for the chart region. */
  label?: string;
  className?: string;
}

type Placed = { id: string; x: number; y: number; depth: number; parentId?: string };

/** Tidy-tree layout (Reingold–Tilford lite): leaves claim a horizontal unit,
 *  parents centre over their children, depth sets the row. Returns placed
 *  coordinates in surface px plus child/parent lookups for keyboard traversal.
 *  Cycle-safe via a `seen` guard so a malformed parentId loop can't hang it. */
function layoutTree(nodes: DitherOrgNode[]): {
  placed: Map<string, Placed>;
  children: Map<string, string[]>;
  parent: Map<string, string | undefined>;
  roots: string[];
} {
  const byId = new Map<string, DitherOrgNode>();
  for (const n of nodes) byId.set(n.id, n);
  const children = new Map<string, string[]>();
  const parent = new Map<string, string | undefined>();
  const roots: string[] = [];
  for (const n of nodes) {
    const p = n.parentId && byId.has(n.parentId) ? n.parentId : undefined;
    parent.set(n.id, p);
    if (p) {
      const arr = children.get(p) ?? [];
      arr.push(n.id);
      children.set(p, arr);
    } else {
      roots.push(n.id);
    }
  }

  const placed = new Map<string, Placed>();
  let cursor = 0;
  const seen = new Set<string>();

  function place(id: string, depth: number): void {
    if (seen.has(id)) return;
    seen.add(id);
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      placed.set(id, { id, x: cursor, y: depth * LEVEL_H, depth, parentId: parent.get(id) });
      cursor += UNIT_W + SIBLING_GAP;
      return;
    }
    for (const ch of kids) place(ch, depth + 1);
    const first = placed.get(kids[0]);
    const last = placed.get(kids[kids.length - 1]);
    const cx = first && last ? (first.x + last.x) / 2 : cursor;
    placed.set(id, { id, x: cx, y: depth * LEVEL_H, depth, parentId: parent.get(id) });
  }

  for (const root of roots) {
    place(root, 0);
    cursor += ROOT_GAP;
  }
  // Orphans (unreachable due to a cycle break) still render on the root row.
  for (const n of nodes) if (!placed.has(n.id)) placed.set(n.id, { id: n.id, x: cursor, y: 0, depth: 0, parentId: undefined });

  return { placed, children, parent, roots };
}

/**
 * DitherOrgChart — a hierarchical org / dependency tree laid out as a directed
 * graph. Children auto-layout below their parent (tidy-tree); connectors are
 * cubic beziers painted on a `<canvas>` as an **ordered-dither stroke** — each
 * backing pixel along the curve lights only when its density clears the Bayer
 * threshold, so the wires read as crisp dither, not smooth lines (the same
 * recipe as `DitherFlow`).
 *
 * The surface pans (drag the background) and zooms (wheel) using the kit's
 * gesture math (`velocityFrom` → `project` for the flick landing, `rubberband`
 * for the springy edge). Clicking — or pressing Enter on — a node focuses it
 * and recentres it in the viewport.
 *
 * Accessibility: the viewport is a focusable `role="application"`; nodes are
 * `role="button"` with roving tabindex (the focused node holds tabindex 0).
 * ArrowUp = parent, ArrowDown = first child, ArrowLeft/Right = siblings, Home =
 * first root, Enter = focus + centre.
 *
 * Hydration: pan/zoom start at fixed `{0,0}` / `1`; node coordinates reaching a
 * CSS transform are rounded through `px`/`round` (the dither stroke lives only
 * on the canvas, which never hydrates). SSR-safe: all DOM/observer work is in
 * effects.
 */
export function DitherOrgChart({
  nodes,
  focusId: focusIdProp,
  onFocusChange,
  color: colorProp,
  seed,
  label = "Organization chart",
  className,
}: DitherOrgChartProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "purple";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const { placed, children, parent, roots } = useMemo(() => layoutTree(nodes), [nodes]);

  const [internalFocus, setInternalFocus] = useState<string | null>(null);
  const focusId = focusIdProp !== undefined ? focusIdProp : internalFocus;
  // Ensure a focus exists once the tree mounts so roving tabindex has an anchor.
  useEffect(() => {
    if (focusIdProp === undefined && internalFocus === null && roots.length > 0) {
      setInternalFocus(roots[0]);
    }
  }, [focusIdProp, internalFocus, roots]);
  const setFocus = useCallback(
    (id: string | null) => {
      if (focusIdProp === undefined) setInternalFocus(id);
      onFocusChange?.(id);
    },
    [focusIdProp, onFocusChange],
  );

  // --- surface + pan/zoom ---------------------------------------------------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cursor, setCursor] = useState<"grab" | "grabbing">("grab");

  // Content bounds drive the pan clamp + rubberband region.
  const bounds = useMemo(() => {
    if (placed.size === 0) return { minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    placed.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    });
    const pad = 80;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [placed]);

  // Handler-side mirrors so the once-attached listeners read fresh values.
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const reduceRef = useRef(false);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { reduceRef.current = pixelPrefersReducedMotion(); }, []);

  type Gesture = {
    mode: "pan";
    pointerId: number;
    startX: number; startY: number;
    startPanX: number; startPanY: number;
    samples: { t: number; x: number; y: number }[];
  };
  const gesture = useRef<Gesture | null>(null);
  const tween = useRef<number>(0);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  const panLimits = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const vw = el.clientWidth, vh = el.clientHeight;
    if (vw <= 0 || vh <= 0) return null;
    const z = zoomRef.current;
    const loX = vw - bounds.maxX * z, hiX = -bounds.minX * z;
    const loY = vh - bounds.maxY * z, hiY = -bounds.minY * z;
    return { vw, vh, loX: Math.min(loX, hiX), hiX: Math.max(loX, hiX), loY: Math.min(loY, hiY), hiY: Math.max(loY, hiY) };
  }, [bounds]);

  const clampPan = useCallback((p: { x: number; y: number }) => {
    const L = panLimits();
    if (!L) return p;
    return { x: clamp(p.x, L.loX, L.hiX), y: clamp(p.y, L.loY, L.hiY) };
  }, [panLimits]);

  const rubberPan = useCallback((p: { x: number; y: number }) => {
    const L = panLimits();
    if (!L) return p;
    let { x, y } = p;
    if (x < L.loX) x = L.loX - rubberband(L.loX - x, L.vw);
    else if (x > L.hiX) x = L.hiX + rubberband(x - L.hiX, L.vw);
    if (y < L.loY) y = L.loY - rubberband(L.loY - y, L.vh);
    else if (y > L.hiY) y = L.hiY + rubberband(y - L.hiY, L.vh);
    return { x, y };
  }, [panLimits]);

  const animateTo = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    cancelAnimationFrame(tween.current);
    if (reduceRef.current) { setPan(to); return; }
    const start = performance.now();
    const dur = 360;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setPan({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, []);

  /** Recentre the surface so `id`'s node sits in the viewport centre. */
  const centerOn = useCallback((id: string) => {
    const el = containerRef.current;
    const p = placed.get(id);
    if (!el || !p) return;
    const z = zoomRef.current;
    const vw = el.clientWidth, vh = el.clientHeight;
    const target = clampPan({
      x: vw / 2 - (p.x + NODE_W / 2) * z,
      y: vh / 2 - (p.y + NODE_H / 2) * z,
    });
    animateTo(panRef.current, target);
  }, [placed, clampPan, animateTo]);

  // --- pointer pan ----------------------------------------------------------
  const onSurfacePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(tween.current);
    containerRef.current?.setPointerCapture?.(e.pointerId);
    gesture.current = {
      mode: "pan",
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      startPanX: panRef.current.x, startPanY: panRef.current.y,
      samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
    };
    setCursor("grabbing");
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const next = rubberPan({ x: g.startPanX + (e.clientX - g.startX), y: g.startPanY + (e.clientY - g.startY) });
    setPan(next);
    g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (g.samples.length > 8) g.samples.shift();
  }, [rubberPan]);

  const finishGesture = useCallback((e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    containerRef.current?.releasePointerCapture?.(e.pointerId);
    const cur = panRef.current;
    if (reduceRef.current) {
      setPan(clampPan(cur));
    } else {
      const vx = velocityFrom(g.samples.map((s) => ({ t: s.t, p: s.x })));
      const vy = velocityFrom(g.samples.map((s) => ({ t: s.t, p: s.y })));
      animateTo(cur, clampPan({ x: cur.x + project(vx), y: cur.y + project(vy) }));
    }
    gesture.current = null;
    setCursor("grab");
  }, [clampPan, animateTo]);

  // --- wheel zoom (non-passive; keeps the world point under the cursor) ------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const z = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nz = clamp(z * factor, 0.25, 3);
      const p = panRef.current;
      const next = { x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz };
      panRef.current = next; zoomRef.current = nz;
      setZoom(nz); setPan(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- keyboard tree traversal ----------------------------------------------
  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!focusId) return;
    const p = placed.get(focusId);
    if (!p) return;
    let nextId: string | null = null;
    switch (e.key) {
      case "ArrowUp": {
        const pid = parent.get(focusId);
        if (pid) nextId = pid;
        break;
      }
      case "ArrowDown": {
        const kids = children.get(focusId);
        if (kids && kids.length) nextId = kids[0];
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const pid = parent.get(focusId);
        const sibs = pid ? children.get(pid) ?? [] : roots;
        const i = sibs.indexOf(focusId);
        if (i >= 0) {
          const ni = e.key === "ArrowLeft" ? i - 1 : i + 1;
          if (ni >= 0 && ni < sibs.length) nextId = sibs[ni];
        }
        break;
      }
      case "Home":
        if (roots.length) nextId = roots[0];
        break;
      case "Enter":
        e.preventDefault();
        centerOn(focusId);
        return;
      default:
        return;
    }
    if (nextId) {
      e.preventDefault();
      setFocus(nextId);
      centerOn(nextId);
    }
  }, [focusId, placed, parent, children, roots, setFocus, centerOn]);

  // --- dither edge canvas ---------------------------------------------------
  const [tick, setTick] = useState(0);
  const visible = useCanvasVisibility(canvasRef, () => setTick((t) => t + 1));
  const colorRgb = useMemo(() => fillOf(color), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    if (!visible()) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    placed.forEach((child) => {
      if (!child.parentId) return;
      const par = placed.get(child.parentId);
      if (!par) return;
      // Top-down connectors: parent bottom-centre → child top-centre.
      const p0: Pt = [par.x + NODE_W / 2, par.y + NODE_H];
      const p3: Pt = [child.x + NODE_W / 2, child.y];
      const dy = Math.max(LEVEL_H * 0.5, Math.abs(p3[1] - p0[1]) * 0.5);
      const cp1: Pt = [p0[0], p0[1] + dy];
      const cp2: Pt = [p3[0], p3[1] - dy];
      const onPath = focusId !== null && (child.id === focusId || child.parentId === focusId);
      const density = onPath ? 0.92 : 0.8;
      const fill = rgb(colorRgb, onPath ? 1 : 0.82, 0.92);
      const r = 1;
      const approx = (Math.abs(p3[0] - p0[0]) + Math.abs(p3[1] - p0[1]) + 64) * zoom * dpr;
      const steps = clamp(Math.round(approx), 32, 800);
      const pts: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [wx, wy] = cubic(p0, cp1, cp2, p3, t);
        pts.push([(wx * zoom + pan.x * dpr) | 0, (wy * zoom + pan.y * dpr) | 0]);
      }
      for (const [cxp, cyp] of pts) stampDisc(ctx, cxp, cyp, r, density, matrix, fill);
    });
  }, [placed, pan, zoom, matrix, colorRgb, focusId, visible, tick]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/60 bg-card/30 outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
        className,
      )}
      style={{ cursor, touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ imageRendering: "pixelated" }}
      />
      <div
        ref={surfaceRef}
        onPointerDown={onSurfacePointerDown}
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${px(pan.x)}, ${px(pan.y)}) scale(${round(zoom)})` }}
      >
        {nodes.map((node) => {
          const p = placed.get(node.id);
          if (!p) return null;
          const focused = node.id === focusId;
          return (
            <div
              key={node.id}
              role="button"
              tabIndex={focused ? 0 : -1}
              aria-pressed={focused}
              aria-label={`Node ${node.label}`}
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={() => { setFocus(node.id); centerOn(node.id); }}
              style={{ position: "absolute", left: px(p.x), top: px(p.y), width: NODE_W, height: NODE_H }}
              className={cn(
                "flex items-center justify-center rounded-md border bg-card/90 px-3 text-center font-mono text-[12px] text-foreground shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                focused ? "border-accent/70 ring-1 ring-accent/30" : "border-border/70 hover:border-foreground/30",
              )}
            >
              {node.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
