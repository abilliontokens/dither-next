"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
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

const NODE_W = 140;
const NODE_H = 44;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// --- dithered bezier stroke ------------------------------------------------

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

/** Stamp a dithered disc: a pixel is lit only when `density` clears its Bayer
 *  threshold — no antialiasing, pure ordered dither. Overlapping stamps along
 *  a densely-sampled bezier form a continuous crisp dithered stroke. */
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

export interface DitherFlowNode {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: ReactNode;
}

export interface DitherFlowEdge {
  id: string;
  from: string;
  to: string;
}

export interface DitherFlowProps {
  nodes: DitherFlowNode[];
  edges: DitherFlowEdge[];
  /** Fired with the next nodes array whenever a node is dragged or nudged. */
  onChange?: (nodes: DitherFlowNode[]) => void;
  selectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
  /** Display-only: disables node dragging and keyboard nudging (pan/zoom stay). */
  readonly?: boolean;
  color?: PixelColor;
  seed?: number;
  /** Accessible label for the graph region (default "Flow graph"). */
  label?: string;
  className?: string;
}

/**
 * DitherFlow — a node-graph canvas. Nodes are pointer-draggable DOM cards; the
 * surface pans (drag the background) and zooms (wheel). Edges are cubic beziers
 * painted on a `<canvas>` as an **ordered-dither stroke** — each pixel along the
 * curve lights only when its density clears the Bayer threshold, so the wires
 * read as crisp dither, not smooth antialiased lines. That stroke is the visual
 * centrepiece.
 *
 * Pan uses the kit's gesture math: `velocityFrom` off the pointer history,
 * `project` for the flick landing, and `rubberband` for the progressive
 * resistance past the content bounds (the surface springs back on release, or
 * snaps under reduced motion).
 *
 * Controlled: the parent owns `nodes`/`edges`; `onChange` fires on drag end and
 * on keyboard nudge. Selection is controlled via `selectedId`/`onSelectedChange`.
 *
 * Accessibility: the viewport is a focusable `role="application"`; nodes are
 * `role="button"` with roving tabindex (the selected node holds tabindex 0).
 * Arrow keys nudge the selected node (Shift = 10px); Enter/Space selects a node
 * under keyboard focus is unnecessary since click already selects.
 *
 * Hydration: pan/zoom start at fixed `{0,0}` / `1`; node coordinates reaching a
 * CSS transform are rounded through `px`/`round` (the dither stroke lives only
 * on the canvas, which never hydrates). SSR-safe: all DOM/observer work is in
 * effects.
 */
export function DitherFlow({
  nodes,
  edges,
  onChange,
  selectedId = null,
  onSelectedChange,
  readonly = false,
  color: colorProp,
  seed,
  label = "Flow graph",
  className,
}: DitherFlowProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "blue";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;


  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Live override for the node currently being dragged — kept in state (not a
  // ref) because the moved card MUST re-render each pointermove. Committed to
  // the controlled `nodes` via `onChange` on pointer up, then cleared.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<"grab" | "grabbing">("grab");

  // Content bounds drive the pan clamp + rubberband region.
  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const w = n.width ?? NODE_W;
      const h = n.height ?? NODE_H;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    }
    const pad = 64;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [nodes]);

  const nodeById = useMemo(() => {
    const m = new Map<string, DitherFlowNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Mirrors so the once-attached wheel/pointer handlers read fresh values
  // without re-subscribing (and without writing refs during render).
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const dragRef = useRef(drag);
  const nodesRef = useRef(nodes);
  const onChangeRef = useRef(onChange);
  const reduceRef = useRef(false);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { reduceRef.current = pixelPrefersReducedMotion(); }, []);

  type Gesture = {
    mode: "pan" | "node";
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    nodeId?: string;
    startNodeX?: number;
    startNodeY?: number;
    samples: { t: number; x: number; y: number }[];
  };
  const gesture = useRef<Gesture | null>(null);
  const tween = useRef<number>(0);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  const panLimits = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw <= 0 || vh <= 0) return null;
    const z = zoomRef.current;
    const loX = vw - bounds.maxX * z;
    const hiX = -bounds.minX * z;
    const loY = vh - bounds.maxY * z;
    const hiY = -bounds.minY * z;
    return {
      vw, vh,
      loX: Math.min(loX, hiX), hiX: Math.max(loX, hiX),
      loY: Math.min(loY, hiY), hiY: Math.max(loY, hiY),
    };
  }, [bounds]);

  const clampPan = useCallback(
    (p: { x: number; y: number }) => {
      const L = panLimits();
      if (!L) return p;
      return { x: clamp(p.x, L.loX, L.hiX), y: clamp(p.y, L.loY, L.hiY) };
    },
    [panLimits],
  );

  const rubberPan = useCallback(
    (p: { x: number; y: number }) => {
      const L = panLimits();
      if (!L) return p;
      let { x, y } = p;
      if (x < L.loX) x = L.loX - rubberband(L.loX - x, L.vw);
      else if (x > L.hiX) x = L.hiX + rubberband(x - L.hiX, L.vw);
      if (y < L.loY) y = L.loY - rubberband(L.loY - y, L.vh);
      else if (y > L.hiY) y = L.hiY + rubberband(y - L.hiY, L.vh);
      return { x, y };
    },
    [panLimits],
  );

  const animateTo = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      cancelAnimationFrame(tween.current);
      if (reduceRef.current) {
        setPan(to);
        return;
      }
      const start = performance.now();
      const dur = 350;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        setPan({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });
        if (t < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    },
    [],
  );

  // --- pointer: pan + node drag --------------------------------------------

  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(tween.current);
      const el = containerRef.current;
      el?.setPointerCapture?.(e.pointerId);
      if (!readonly) onSelectedChange?.(null);
      gesture.current = {
        mode: "pan",
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
      };
      setCursor("grabbing");
    },
    [onSelectedChange, readonly],
  );

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, node: DitherFlowNode) => {
      if (readonly || e.button !== 0) return;
      e.stopPropagation();
      cancelAnimationFrame(tween.current);
      containerRef.current?.setPointerCapture?.(e.pointerId);
      onSelectedChange?.(node.id);
      gesture.current = {
        mode: "node",
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        nodeId: node.id,
        startNodeX: node.x,
        startNodeY: node.y,
        samples: [],
      };
    },
    [onSelectedChange, readonly],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      if (g.mode === "pan") {
        const next = rubberPan({
          x: g.startPanX + (e.clientX - g.startX),
          y: g.startPanY + (e.clientY - g.startY),
        });
        setPan(next);
        g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
        if (g.samples.length > 8) g.samples.shift();
      } else if (g.mode === "node" && g.nodeId !== undefined) {
        const z = zoomRef.current || 1;
        setDrag({
          id: g.nodeId,
          x: (g.startNodeX ?? 0) + (e.clientX - g.startX) / z,
          y: (g.startNodeY ?? 0) + (e.clientY - g.startY) / z,
        });
      }
    },
    [rubberPan],
  );

  const finishGesture = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      containerRef.current?.releasePointerCapture?.(e.pointerId);
      if (g.mode === "node" && g.nodeId !== undefined && dragRef.current) {
        const d = dragRef.current;
        onChangeRef.current?.(
          nodesRef.current.map((n) =>
            n.id === d.id ? { ...n, x: d.x, y: d.y } : n,
          ),
        );
        setDrag(null);
      } else if (g.mode === "pan") {
        const cur = panRef.current;
        if (reduceRef.current) {
          setPan(clampPan(cur));
        } else {
          const vx = velocityFrom(g.samples.map((s) => ({ t: s.t, p: s.x })));
          const vy = velocityFrom(g.samples.map((s) => ({ t: s.t, p: s.y })));
          const target = clampPan({
            x: cur.x + project(vx),
            y: cur.y + project(vy),
          });
          animateTo(cur, target);
        }
      }
      gesture.current = null;
      setCursor("grab");
    },
    [clampPan, animateTo],
  );

  // --- wheel zoom (non-passive so we can preventDefault) --------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const z = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nz = clamp(z * factor, 0.25, 3);
      // Keep the world point under the cursor stationary.
      const p = panRef.current;
      const next = { x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz };
      panRef.current = next;
      zoomRef.current = nz;
      setZoom(nz);
      setPan(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- keyboard nudge -------------------------------------------------------

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (readonly || !selectedId) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowLeft": dx = -step; break;
        case "ArrowRight": dx = step; break;
        case "ArrowUp": dy = -step; break;
        case "ArrowDown": dy = step; break;
        default: return;
      }
      e.preventDefault();
      onChange?.(
        nodes.map((n) =>
          n.id === selectedId
            ? { ...n, x: Math.max(0, n.x + dx), y: Math.max(0, n.y + dy) }
            : n,
        ),
      );
    },
    [nodes, selectedId, onChange, readonly],
  );

  // --- edge canvas ----------------------------------------------------------

  const visible = useCanvasVisibility(canvasRef, () => setTick((t) => t + 1));
  const [tick, setTick] = useState(0);
  const colorRgb = useMemo(() => fillOf(color), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    if (!visible()) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const edge of edges) {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) continue;
      const fw = from.width ?? NODE_W;
      const fh = from.height ?? NODE_H;
      const tw = to.width ?? NODE_W;
      const th = to.height ?? NODE_H;
      const fromCx = from.x + fw / 2;
      const toCx = to.x + tw / 2;
      let p0: Pt;
      let p3: Pt;
      if (toCx >= fromCx) {
        p0 = [from.x + fw, from.y + fh / 2];
        p3 = [to.x, to.y + th / 2];
      } else {
        p0 = [from.x, from.y + fh / 2];
        p3 = [to.x + tw, to.y + th / 2];
      }
      const dx = Math.abs(p3[0] - p0[0]);
      const cp1: Pt = [p0[0] + dx * 0.5, p0[1]];
      const cp2: Pt = [p3[0] - dx * 0.5, p3[1]];

      const isSel =
        selectedId !== null && (edge.from === selectedId || edge.to === selectedId);
      const density = isSel ? 0.92 : 0.8;
      const fill = rgb(colorRgb, isSel ? 1 : 0.82, 0.92);
      const r = 1;

      // Screen-space arc length decides sample density so the stroke is gapless
      // at every zoom without oversampling short edges.
      const approx = (Math.abs(p3[0] - p0[0]) + Math.abs(p3[1] - p0[1]) + 64) * zoom * dpr;
      const steps = clamp(Math.round(approx / 1), 32, 800);
      const pts: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [wx, wy] = cubic(p0, cp1, cp2, p3, t);
        pts.push([(wx * zoom + pan.x * dpr) | 0, (wy * zoom + pan.y * dpr) | 0]);
      }
      for (const [cxp, cyp] of pts) stampDisc(ctx, cxp, cyp, r, density, matrix, fill);

      // Arrowhead at the target port.
      const [tx, ty] = pts[pts.length - 1];
      const back = pts[Math.max(0, pts.length - 4)];
      const ang = Math.atan2(ty - back[1], tx - back[0]);
      for (const s of [-0.5, 0.5]) {
        const a = ang + Math.PI + s;
        stampDisc(ctx, (tx + Math.cos(a) * 5) | 0, (ty + Math.sin(a) * 5) | 0, r, density, matrix, fill);
      }
    }
  }, [edges, nodeById, nodes, pan, zoom, matrix, colorRgb, selectedId, visible, tick]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (!readonly && !selectedId && nodes.length) onSelectedChange?.(nodes[0].id);
      }}
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
          const live = drag?.id === node.id ? drag : node;
          const selected = node.id === selectedId;
          return (
            <div
              key={node.id}
              role="button"
              tabIndex={-1}
              aria-pressed={selected}
              aria-disabled={readonly || undefined}
              aria-label={`Node ${typeof node.label === "string" ? node.label : node.id}`}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              style={{
                position: "absolute",
                left: px(live.x),
                top: px(live.y),
                width: node.width ?? NODE_W,
                height: node.height ?? NODE_H,
              }}
              className={cn(
                "flex items-center justify-center rounded-md border bg-card/90 px-3 text-center font-mono text-[12px] text-foreground shadow-sm transition-shadow",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                selected
                  ? "border-accent/70 ring-1 ring-accent/30"
                  : "border-border/70 hover:border-foreground/30",
                readonly ? "cursor-default" : "cursor-grab active:cursor-grabbing",
              )}
            >
              {node.label ?? node.id}
            </div>
          );
        })}
      </div>
    </div>
  );
}
