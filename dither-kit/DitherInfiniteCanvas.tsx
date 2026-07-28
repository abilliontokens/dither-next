"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./lib";

/**
 * DitherInfiniteCanvas — pannable, zoomable work surface. Verbatim port of
 * DitherInfiniteCanvas.vue.
 *
 * Drag to pan, wheel to zoom toward the cursor (the world point under the
 * cursor stays put), and the dotted/grid field rides the same transform so
 * space feels real. Content lives in `children` at world coordinates.
 *
 * `zoom` is `v-model:zoom` in Vue → controlled `zoom` prop + `onZoomChange`.
 * The wheel handler must call `preventDefault()` to stop the page scrolling —
 * React attaches its synthetic `onWheel` as a passive root listener, so
 * `preventDefault` is silently ignored. We attach a native non-passive
 * `wheel` listener in an effect instead. The latest pan/zoom state is read
 * through a ref-of-closure so the listener attaches once and never goes stale.
 */
export interface DitherInfiniteCanvasProps {
  /** Zoom (v-model:zoom). */
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pattern?: "dots" | "grid" | "plain";
  /** Pattern pitch at zoom 1, CSS px. */
  cell?: number;
  label?: string;
  className?: string;
  onZoomChange?: (zoom: number) => void;
  children?: React.ReactNode;
}

export function DitherInfiniteCanvas({
  zoom = 1,
  minZoom = 0.25,
  maxZoom = 3,
  pattern = "dots",
  cell = 16,
  label = "Infinite canvas",
  className,
  onZoomChange,
  children,
}: DitherInfiniteCanvasProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // Internal zoom mirrors the controlled `zoom` prop; Vue's `z = ref(zoom)` +
  // `watch(() => props.zoom)` resync. SSR-safe: pure clamp math, no DOM.
  const [z, setZ] = useState(() => Math.min(maxZoom, Math.max(minZoom, zoom)));

  useEffect(() => {
    setZ(Math.min(maxZoom, Math.max(minZoom, zoom)));
  }, [zoom, minZoom, maxZoom]);

  const [panning, setPanning] = useState(false);
  const pointerIdRef = useRef(-1);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return;
    setPanning(true);
    pointerIdRef.current = e.pointerId;
    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;
    el.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (!panning || e.pointerId !== pointerIdRef.current) return;
    const dx = e.clientX - lastXRef.current;
    const dy = e.clientY - lastYRef.current;
    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;
    setTx((v) => v + dx);
    setTy((v) => v + dy);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.pointerId === pointerIdRef.current) setPanning(false);
  }

  // Wheel zoom anchored to the cursor. Native + non-passive so preventDefault
  // reliably halts page scroll (React's synthetic onWheel is passive).
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const node = el.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    // `wheelRef.current` is reassigned every render, so this closure always
    // holds the latest z/tx/ty — read them directly instead of nesting the
    // pan updates inside setZ's updater (React may double-invoke updaters in
    // strict mode, which would double-apply the pan).
    const next = Math.min(maxZoom, Math.max(minZoom, z * Math.exp(-e.deltaY * 0.0015)));
    const k = next / z;
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    setTx(cx - (cx - tx) * k);
    setTy(cy - (cy - ty) * k);
    setZ(next);
    onZoomChange?.(next);
  };
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const listener = (e: WheelEvent) => wheelRef.current(e);
    node.addEventListener("wheel", listener, { passive: false });
    return () => node.removeEventListener("wheel", listener);
  }, []);

  const layer = (zoomed: number): React.CSSProperties => {
    const c = `${cell * zoomed}px ${cell * zoomed}px`;
    if (pattern === "dots") {
      return {
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: c,
      };
    }
    if (pattern === "grid") {
      return {
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: c,
      };
    }
    return {};
  };

  return (
    <div
      ref={el}
      role="group"
      aria-label={label}
      className={cn(
        "relative touch-none overflow-hidden bg-background/40 select-none",
        panning ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ ...layer(z), backgroundPosition: `${tx}px ${ty}px` }}
      />
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})` }}
      >
        {children}
      </div>
    </div>
  );
}
