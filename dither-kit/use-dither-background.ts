"use client"

// Shared runtime for the generative canvas backgrounds (aurora, faulty-terminal,
// ferrofluid, ...). It owns the throttled rAF loop, the backing buffer + upload,
// the visibility gate, resize, dpr scaling, the static / reduced-motion single
// frame, and the mount/restart/teardown lifecycle. A component supplies only its
// per-frame `render`; everything mechanical lives here once, not per component.
//
// React port of the Vue `useDitherBackground` composable. The runtime below is
// framework-agnostic and created once per mount; it reads the latest options
// through a Box (`{ readonly current }`) refreshed on every render, so a
// re-render never forks or restarts the loop and the loop never reads stale
// props. The Vue lifecycle (onSeek + onMounted + watch(restart) +
// watch(paused) + onBeforeUnmount) maps onto three effects: a mount effect that
// subscribes to the kit clock and tears down, a restart effect keyed on the
// restart deps (it also runs on mount, standing in for onMounted(start)), and a
// paused effect that stops/wakes on a change. `nextTick` is unnecessary —
// effects run after DOM commit, which is the phase Vue's nextTick deferred to.

import { useCallback, useEffect, useRef } from "react"
import { directedTime, isDirected, onSeek } from "./clock"
import { pixelPrefersReducedMotion } from "./pixel"
import { createRasterBuffer, putRasterBuffer, type RasterBuffer } from "./raster"
import type { DitherRenderMode } from "./precompile"
import { frameIndex } from "./timing"
import { useCanvasVisibility } from "./use-visibility"

export type DitherBackgroundOptions = {
  wrapRef: React.RefObject<HTMLElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Backing cell size in CSS px before dpr scaling — bigger = chunkier
   * (a getter when it is a prop). */
  cell: number | (() => number)
  maxCols: number
  maxRows: number
  /** Getters into reactive props (the hook never reads props directly). */
  dpr: () => number | undefined
  paused: () => boolean
  renderMode: () => DitherRenderMode
  precompiled: () => string | undefined
  /** Reactive sources that force a full restart when they change (compared
   * element-wise when an array, the way Vue's watch fires on a source change). */
  restart: () => unknown
  /** dt multiplier for the clock — e.g. a `timeScale` prop. Default 1. */
  timeScale?: () => number
  /**
   * Stop-motion cadence: when > 0, paint only on wall-time frame boundaries at
   * this fps (`timing.frameIndex`) — between boundaries the previous raster is
   * held, so the surface steps like film AND skips the buffer upload entirely.
   * 0/undefined keeps the smooth ~30fps paint throttle.
   */
  frameRate?: () => number | undefined
  /** Clock value used for the single static / reduced-motion frame. Default 4. */
  staticClock?: number
  /**
   * Fill `buffer` for one frame.
   * @param clock   seconds elapsed, scaled by timeScale.
   * @param dt      seconds since the previous painted frame (0 on the first).
   * @param elapsed ms since this run started (drives page-load fades).
   */
  render: (buffer: RasterBuffer, clock: number, dt: number, elapsed: number) => void
  /** After the raster is on the canvas — e.g. copy it onto a bloom layer. */
  afterPaint?: (canvas: HTMLCanvasElement) => void
}

/**
 * A painted surface as other surfaces see it — the render graph's edge. A
 * consumer (a shader channel, a world material) reads a source through this
 * handle: `pull(ms)` paints the directed moment on demand when the source
 * has not painted it yet, so a consumer always reads a source at its own
 * time stamp whatever order the clock reaches them in.
 */
export type DitherSurface = {
  /** The raster as of the last paint, null before the first. */
  raster: () => RasterBuffer | null
  /** Paints `ms` now when directed and not yet painted; free-running or null, the latest raster. */
  pull: (ms: number | null) => RasterBuffer | null
  /** Bumps on every paint — consumers skip re-uploads while it is unchanged. */
  version: () => number
  /** The canvas the raster is uploaded to (null before mount). */
  canvas: () => HTMLCanvasElement | null
}

const surfaces = new WeakMap<HTMLCanvasElement, DitherSurface>()

/** The surface behind a kit canvas, when the canvas is one of this runtime's. */
export const surfaceOf = (canvas: HTMLCanvasElement | null | undefined): DitherSurface | null =>
  canvas ? (surfaces.get(canvas) ?? null) : null

type Box<T> = { readonly current: T }

type BackgroundRuntime = {
  surface: DitherSurface
  start: () => void
  stop: () => void
  wake: () => void
  seekTo: (ms: number) => void
  /** Unmount: invalidate any pending one-shot, then stop. */
  dispose: () => void
}

/** The loop itself — verbatim Vue runtime logic, reading options through `opts.current`. */
function createBackgroundRuntime(opts: Box<DitherBackgroundOptions>, isVisible: () => boolean): BackgroundRuntime {
  let raf = 0
  let ro: ResizeObserver | null = null
  let restartToken = 0
  let clock = 0
  let lastPaint = 0
  let lastFrame = -1
  let startNow = 0
  let lastSeek = -1
  let paintedSeek = -1
  let version = 0
  let buffer: RasterBuffer | null = null
  let imageData: ImageData | undefined
  const surface: DitherSurface = {
    raster: () => buffer,
    pull(ms) {
      if (ms !== null && isDirected()) seekTo(ms)
      return buffer
    },
    version: () => version,
    canvas: () => opts.current.canvasRef.current,
  }

  function dprFactor(): number {
    const raw = opts.current.dpr() ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    return Math.max(0.5, Math.min(3, raw))
  }

  /** (Re)size the backing buffer to the element. */
  function measure(): CanvasRenderingContext2D | null {
    const o = opts.current
    const wrap = o.wrapRef.current
    const canvas = o.canvasRef.current
    // React can transiently hand back a reused element that is not (yet) a real
    // <canvas> during a large mount; bail without throwing and retry next
    // frame rather than calling getContext on a non-canvas.
    if (!wrap || !canvas || typeof canvas.getContext !== "function") return null
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    const box = wrap.getBoundingClientRect()
    const unit = (typeof o.cell === "function" ? o.cell() : o.cell) / dprFactor()
    const cols = Math.min(o.maxCols, Math.max(8, Math.round(box.width / unit)))
    const rows = Math.min(o.maxRows, Math.max(8, Math.round(box.height / unit)))
    if (!buffer || buffer.width !== cols || buffer.height !== rows) {
      buffer = createRasterBuffer(cols, rows)
      imageData = undefined
      paintedSeek = -1
      canvas.width = cols
      canvas.height = rows
    }
    if (!surfaces.has(canvas)) surfaces.set(canvas, surface)
    return ctx
  }

  function draw(ctx: CanvasRenderingContext2D, dt: number, elapsed: number) {
    if (!buffer) return
    const o = opts.current
    o.render(buffer, clock, dt, elapsed)
    imageData = putRasterBuffer(ctx, buffer, imageData)
    version++
    const canvas = o.canvasRef.current
    if (o.afterPaint && canvas) o.afterPaint(canvas)
  }

  function frame(now: number) {
    raf = 0
    if (!isVisible() || isDirected()) return
    const o = opts.current
    // Paused holds the raster but never leaves it blank: the first frame (and
    // the one after a restart) still paints, then the loop stands down.
    const paused = o.paused()
    if (paused && lastPaint) return
    // Cadence gates run BEFORE measure(): a held frame must not read layout.
    // Measuring first cost one getBoundingClientRect + getContext per surface
    // per vsync, paints or not (measured, three 8fps landing surfaces at 4x
    // CPU: script time -28%, getBoundingClientRect self time -63%).
    const fps = o.frameRate?.() || 0
    // Stop-motion gate: hold the last raster until wall time crosses the next
    // fps boundary (dt below spans the held frames, so the clock never loses
    // time between paints); without a frameRate, the smooth ~30fps throttle.
    const idx = fps > 0 ? frameIndex(now - startNow, fps) : -1
    const held = fps > 0 ? idx === lastFrame : now - lastPaint < 33
    if (held) {
      raf = requestAnimationFrame(frame)
      return
    }
    const ctx = measure()
    if (!ctx) {
      // Canvas ref not ready yet — keep the loop alive and retry next frame
      // (the boundary is consumed only by a frame that actually paints).
      raf = requestAnimationFrame(frame)
      return
    }
    lastFrame = idx
    // The default dt clamp survives tab stalls; at low cadence one frame can
    // span >100ms, so widen it to two frame periods when frameRate is set.
    const cap = fps > 0 ? Math.max(0.1, 2 / fps) : 0.1
    const dt = lastPaint ? Math.min(cap, (now - lastPaint) / 1000) : 0
    lastPaint = now
    clock += dt * (o.timeScale ? o.timeScale() : 1)
    draw(ctx, dt, now - startNow)
    if (!paused) raf = requestAnimationFrame(frame)
  }

  function wake() {
    if (isDirected()) {
      seekTo(directedTime() ?? 0)
      return
    }
    const o = opts.current
    // A still surface (static mode, reduced motion) painted its one frame in
    // start(); the visibility wake must never start the loop behind it.
    if (o.renderMode() === "static" || pixelPrefersReducedMotion()) return
    if (!raf && !o.paused() && isVisible()) {
      lastPaint = 0
      lastFrame = -1 // a resume paints immediately instead of waiting a boundary
      raf = requestAnimationFrame(frame)
    }
  }

  /** Directed (clock.ts): paint one moment. `clock` is absolute, so pure
   * renderers land on the exact frame; `dt` is the step since the last
   * directed moment (0 when first or backwards), so simulations advance
   * frame by frame in capture order. */
  function seekTo(ms: number) {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    const o = opts.current
    if (o.paused() || o.precompiled() || o.renderMode() === "static") return
    const ctx = measure()
    if (!ctx) return
    // A moment paints once: a consumer's pull and the clock's own call agree.
    if (paintedSeek === ms) return
    const scale = o.timeScale ? o.timeScale() : 1
    const dt = lastSeek >= 0 && ms > lastSeek ? Math.min(0.1, (ms - lastSeek) / 1000) : 0
    lastSeek = ms
    paintedSeek = ms
    clock = (ms / 1000) * scale
    draw(ctx, dt, ms)
  }

  function start() {
    const token = ++restartToken
    stop()
    const o = opts.current
    if (o.precompiled()) return
    // Vue deferred the rest with nextTick until after the DOM update; in React
    // the effect already runs after DOM commit, so it runs synchronously.
    startNow = typeof performance !== "undefined" ? performance.now() : 0
    lastPaint = 0
    lastSeek = -1
    paintedSeek = -1
    if (o.renderMode() === "static" || pixelPrefersReducedMotion()) {
      clock = o.staticClock ?? 4
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
        if (isDirected()) {
          seekTo(directedTime() ?? 0)
          return
        }
        if (raf) return
        const c = measure()
        if (c && opts.current.paused()) draw(c, 0, 1e6)
      })
      const wrap = o.wrapRef.current
      if (wrap) ro.observe(wrap)
    }
    if (isDirected()) {
      seekTo(directedTime() ?? 0)
      return
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

  function dispose() {
    restartToken += 1
    stop()
  }

  return { surface, start, stop, wake, seekTo, dispose }
}

/** Restart deps changed? Vue's watch fires when a source the getter reads
 * changes; a getter returning `[a, b, c]` compares element-wise here. */
function sameRestart(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

export function useDitherBackground(opts: DitherBackgroundOptions): DitherSurface {
  // The Box the loop reads each frame — refreshed every render, never a restart.
  const box = useRef(opts)
  box.current = opts
  const runtime = useRef<BackgroundRuntime | null>(null)
  // Stable wake, so the visibility observer subscribes once per mount.
  const onWake = useCallback(() => runtime.current?.wake(), [])
  const isVisible = useCanvasVisibility(opts.wrapRef, onWake)
  const rt = (runtime.current ??= createBackgroundRuntime(box, isVisible))

  // Bump a key only when the restart deps actually change, so an unrelated
  // re-render (a parent update, a new params object) never restarts the loop.
  const restartDeps = opts.restart()
  const restart = useRef({ deps: restartDeps, key: 0 })
  if (!sameRestart(restart.current.deps, restartDeps)) {
    restart.current = { deps: restartDeps, key: restart.current.key + 1 }
  }
  const restartKey = restart.current.key

  // Mount: follow the kit clock (directed moments / release), tear down on
  // unmount — Vue's onSeek at setup + onBeforeUnmount(unseek + stop).
  useEffect(() => {
    const unseek = onSeek((ms) => (ms === null ? rt.wake() : rt.seekTo(ms)))
    return () => {
      unseek()
      rt.dispose()
    }
  }, [rt])

  // Paused: stop when paused, wake when resumed — on a change only, like
  // Vue's watch(opts.paused, (p) => (p ? stop() : wake())); a surface mounted
  // paused still paints its first frame through start(). Declared before the
  // restart effect: Vue's paused watcher flushes "pre", ahead of the "post"
  // restart, so a restart landing with a pause still paints its one frame.
  const paused = opts.paused()
  const pausedSeen = useRef(paused)
  useEffect(() => {
    if (pausedSeen.current === paused) return
    pausedSeen.current = paused
    if (paused) rt.stop()
    else rt.wake()
  }, [rt, paused])

  // Start on mount and again whenever the restart deps change — Vue's
  // onMounted(start) + watch(opts.restart, start, { flush: "post" }).
  useEffect(() => {
    rt.start()
  }, [rt, restartKey])

  return rt.surface
}
