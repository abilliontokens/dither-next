"use client"

// Shared runtime for the generative canvas backgrounds (aurora, faulty-terminal,
// ferrofluid, ...). It owns the throttled rAF loop, the backing buffer + upload,
// the visibility gate, resize, dpr scaling, the static / reduced-motion single
// frame, and the mount/restart/teardown lifecycle. A component supplies only its
// per-frame `render`; everything mechanical lives here once, not per component.
//
// React port of the Vue `useDitherBackground` composable. The Vue lifecycle
// (onMounted + onBeforeUnmount + watch(restart) + watch(paused)) collapses into
// three effects: a mount effect that starts/stops the loop, a restart effect
// that re-runs start() when the restart deps change, and a paused effect that
// stops/wakes the loop. `nextTick` is unnecessary — effects run after DOM
// commit, which is the phase Vue's nextTick was deferring to.

import { useEffect } from "react"
import { pixelPrefersReducedMotion } from "./pixel"
import { createRasterBuffer, putRasterBuffer, type RasterBuffer } from "./raster"
import type { DitherRenderMode } from "./precompile"
import { useCanvasVisibility } from "./use-visibility"

export type DitherBackgroundOptions = {
  wrapRef: React.RefObject<HTMLElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Backing cell size in CSS px before dpr scaling — bigger = chunkier. */
  cell: number
  maxCols: number
  maxRows: number
  /** Getters into reactive props (the hook never reads props directly). */
  dpr: () => number | undefined
  paused: () => boolean
  renderMode: () => DitherRenderMode
  precompiled: () => string | undefined
  /** Reactive sources that force a full restart when they change. */
  restart: () => unknown
  /** dt multiplier for the clock — e.g. a `timeScale` prop. Default 1. */
  timeScale?: () => number
  /** Clock value used for the single static / reduced-motion frame. Default 4. */
  staticClock?: number
  /**
   * Fill `buffer` for one frame.
   * @param clock   seconds elapsed, scaled by timeScale.
   * @param dt      seconds since the previous painted frame (0 on the first).
   * @param elapsed ms since this run started (drives page-load fades).
   */
  render: (buffer: RasterBuffer, clock: number, dt: number, elapsed: number) => void
}

export function useDitherBackground(opts: DitherBackgroundOptions): void {
  // All loop state lives in module-scoped locals captured by the closures below.
  // We keep them in refs-of-refs pattern via a single mutable holder so the
  // mount effect (empty deps) owns the loop, while the restart/paused effects
  // can re-trigger start/wake without re-subscribing the visibility observer.
  let raf = 0
  let ro: ResizeObserver | null = null
  let restartToken = 0
  let clock = 0
  let lastPaint = 0
  let startNow = 0
  let buffer: RasterBuffer | null = null
  let imageData: ImageData | undefined
  const isVisible = useCanvasVisibility(opts.wrapRef, () => wake())

  function dprFactor(): number {
    const raw = opts.dpr() ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    return Math.max(0.5, Math.min(3, raw))
  }

  /** (Re)size the backing buffer to the element. */
  function measure(): CanvasRenderingContext2D | null {
    const wrap = opts.wrapRef.current
    const canvas = opts.canvasRef.current
    // React can transiently hand back a reused element that is not (yet) a real
    // <canvas> during a large mount; bail without throwing and retry next
    // frame rather than calling getContext on a non-canvas.
    if (!wrap || !canvas || typeof canvas.getContext !== "function") return null
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    const box = wrap.getBoundingClientRect()
    const unit = opts.cell / dprFactor()
    const cols = Math.min(opts.maxCols, Math.max(8, Math.round(box.width / unit)))
    const rows = Math.min(opts.maxRows, Math.max(8, Math.round(box.height / unit)))
    if (!buffer || buffer.width !== cols || buffer.height !== rows) {
      buffer = createRasterBuffer(cols, rows)
      imageData = undefined
      canvas.width = cols
      canvas.height = rows
    }
    return ctx
  }

  function draw(ctx: CanvasRenderingContext2D, dt: number, elapsed: number) {
    if (!buffer) return
    opts.render(buffer, clock, dt, elapsed)
    imageData = putRasterBuffer(ctx, buffer, imageData)
  }

  function frame(now: number) {
    raf = 0
    if (!isVisible() || opts.paused()) return
    const ctx = measure()
    if (!ctx) {
      // Canvas ref not ready yet — keep the loop alive and retry next frame.
      raf = requestAnimationFrame(frame)
      return
    }
    if (now - lastPaint < 33) {
      raf = requestAnimationFrame(frame)
      return
    }
    const dt = lastPaint ? Math.min(0.1, (now - lastPaint) / 1000) : 0
    lastPaint = now
    clock += dt * (opts.timeScale ? opts.timeScale() : 1)
    draw(ctx, dt, now - startNow)
    raf = requestAnimationFrame(frame)
  }

  function wake() {
    if (!raf && !opts.paused() && opts.renderMode() !== "static" && isVisible()) {
      lastPaint = 0
      raf = requestAnimationFrame(frame)
    }
  }

  function start() {
    const token = ++restartToken
    stop()
    if (opts.precompiled()) return
    // Vue deferred this with nextTick until after the DOM update; in React the
    // effect already runs after DOM commit, so we run synchronously.
    if (token !== restartToken || opts.precompiled()) return
    startNow = typeof performance !== "undefined" ? performance.now() : 0
    lastPaint = 0
    if (opts.renderMode() === "static" || pixelPrefersReducedMotion()) {
      clock = opts.staticClock ?? 4
      // Retry the one-shot until the canvas ref settles.
      const paintOnce = () => {
        if (token !== restartToken) return
        const ctx = measure()
        if (!ctx) {
          raf = requestAnimationFrame(paintOnce)
          return
        }
        draw(ctx, 0, 1e6) // elapsed large -> any page-load fade reads complete
      }
      paintOnce()
      return
    }
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (raf) return
        const c = measure()
        if (c && opts.paused()) draw(c, 0, 1e6)
      })
      if (opts.wrapRef.current) ro.observe(opts.wrapRef.current)
    }
    // frame() paints the first frame and retries until the canvas is ready.
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    ro?.disconnect()
    ro = null
  }

  // Mount: start the loop, tear it down on unmount. Empty deps = mount-only,
  // mirroring Vue's onMounted(start) + onBeforeUnmount(stop). The closures
  // read opts getters (dpr/paused/renderMode/...) fresh each frame, so they
  // never go stale without re-subscribing.
  useEffect(() => {
    start()
    return () => {
      restartToken += 1
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restart: when the restart deps change, re-run start(). Vue used
  // watch(opts.restart, start, { flush: "post" }); React keys the effect on the
  // restart value so it re-runs exactly when that value changes.
  const restartValue = opts.restart()
  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartValue])

  // Paused: stop when paused, wake when resumed. Vue used
  // watch(opts.paused, (p) => (p ? stop() : wake())).
  const pausedValue = opts.paused()
  useEffect(() => {
    if (pausedValue) stop()
    else wake()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedValue])
}
