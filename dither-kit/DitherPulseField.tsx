"use client"

import { useEffect, useMemo, useRef } from "react"
import type { Rgb } from "./palette"
import {
  clearRasterBuffer,
  createRasterBuffer,
  putRasterBuffer,
  setOrBlendRasterPixel,
  type RasterBuffer,
} from "./raster"
import { mulberry32 } from "./dither-paint"
import {
  BAYER4,
  fillOf,
  type PixelColor,
  pixelMatrixFromSeed,
  pixelPrefersReducedMotion,
} from "./pixel"
import { useCanvasVisibility } from "./use-visibility"

const CELL = 3

/** One frame of the pulse field. A radial wave radiates from the seeded
 * center; each dot's brightness is the wave envelope dithered against the
 * seeded Bayer matrix so the field reads as ordered-dither, not a blob. */
function paintField(
  buf: RasterBuffer,
  cols: number,
  rows: number,
  fill: Rgb,
  phase: number,
  matrix: number[][],
  p: PulseParams
): void {
  clearRasterBuffer(buf)
  const cx = p.cx * cols
  const cy = p.cy * rows
  const maxR = Math.hypot(cols, rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Grid spacing: dots live on a CELL grid, not every pixel.
      if ((x % CELL !== 0) || (y % CELL !== 0)) continue
      const dx = x - cx
      const dy = y - cy
      const r = Math.hypot(dx, dy) / maxR // 0..1 normalized
      // Radial wave: brightness peaks at the wave front, decays with distance.
      const wavePos = (r - phase * p.speed) * p.waves
      const wave = Math.sin(wavePos * Math.PI * 2)
      // Envelope: fade from center outward so the field has a focal point.
      const env = Math.max(0, 1 - r * p.falloff)
      let bright = Math.max(0, wave) * env
      // Add a subtle static base so empty areas still read as a dither field.
      bright = bright * p.intensity + p.baseGlow * env
      if (bright <= 0 || bright <= matrix[y & 3][x & 3]) continue
      const alpha = Math.min(1, bright)
      setOrBlendRasterPixel(buf, x, y, fill, alpha)
    }
  }
}

/** Seeded pulse-field personality: center position, wave count, speed, falloff,
 * and base glow. One integer yields a unique field - a tight pulse, a slow
 * ripple, a wide wash. Ranges bounded so no seed is unreadable. */
export type PulseParams = {
  cx: number
  cy: number
  waves: number
  speed: number
  falloff: number
  intensity: number
  baseGlow: number
}

export function pulseFromSeed(seed: number): PulseParams {
  const rand = mulberry32(Math.round(seed) ^ 0x4a5b7c8d)
  return {
    cx: 0.2 + rand() * 0.6,
    cy: 0.2 + rand() * 0.6,
    waves: 2 + rand() * 5,
    speed: 0.15 + rand() * 0.35,
    falloff: 0.6 + rand() * 0.8,
    intensity: 0.5 + rand() * 0.5,
    baseGlow: 0.04 + rand() * 0.08,
  }
}

export interface DitherPulseFieldProps {
  color?: PixelColor
  seed?: number
  cell?: number
  class?: string
}

/**
 * A seeded radial-wave pulse field rendered to a pixelated canvas. One seed
 * picks the center, wave count, speed, falloff, and base glow; the fill
 * colour is the single dither colour, varied only by alpha. The wave radiates
 * outward and is thresholded against a seeded Bayer matrix so the field reads
 * as ordered-dither, not a blob.
 *
 * React port of `DitherPulseField.vue`. The Vue `init()` / `restartRuntime()` /
 * `restartToken` + `onMounted`/`onBeforeUnmount` collapses into a single
 * `useEffect` owning the RAF loop (guide sections 2 and 9). `useCanvasVisibility`
 * gates the loop: it defaults PAUSED until IntersectionObserver reports
 * visible; `onWake` resumes the SAME closure so timing is preserved (no replay,
 * no state loss). `willReadFrequently: true` on the primary context;
 * `RasterBuffer` + `putRasterBuffer` (no per-pixel `fillRect`).
 * `prefers-reduced-motion` renders a single static frame and skips the loop.
 *
 * The initial `getBoundingClientRect` is deferred to `requestAnimationFrame`
 * to avoid forced reflow during mount when many components mount at once
 * (guide section 9.4 - RAF deferral beats nextTick).
 */
export function DitherPulseField({
  color = "blue",
  seed = 42,
  cell = CELL,
  class: className,
}: DitherPulseFieldProps) {
  const pulse = useMemo(() => pulseFromSeed(seed), [seed])
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed]
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // `wake` is set by the init closure to a function that restarts the RAF
  // loop; the visibility hook calls it when the canvas re-enters the viewport.
  const wakeRef = useRef<(() => void) | undefined>(undefined)
  const teardownRef = useRef<(() => void) | undefined>(undefined)
  const restartToken = useRef(0)
  // Pause the pulse loop while scrolled/panned off-screen; resume on re-entry.
  const isVisible = useCanvasVisibility(canvasRef, () => wakeRef.current?.())

  useEffect(() => {
    const token = ++restartToken.current
    // Defer the measure + init to RAF: getBoundingClientRect during mount
    // forces reflow when many components mount at once (guide section 9.4).
    const sched = requestAnimationFrame(() => {
      if (token !== restartToken.current) return

      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d", { willReadFrequently: true })
      if (!canvas || !ctx) return

      const fill = fillOf(color)
      const rect = canvas.getBoundingClientRect()
      const cols = Math.max(8, Math.round(rect.width / cell))
      const rows = Math.max(8, Math.round(rect.height / cell))
      canvas.width = cols
      canvas.height = rows

      let raf = 0
      let last = 0
      const buffer = createRasterBuffer(cols, rows)
      let imageData: ImageData | undefined

      // Paint the initial frame (phase 0) immediately so the field reads
      // instantly, even when reduced-motion skips the loop.
      paintField(buffer, cols, rows, fill, 0, matrix, pulse)
      imageData = putRasterBuffer(ctx, buffer, imageData)

      wakeRef.current = undefined
      if (!pixelPrefersReducedMotion()) {
        const frame = (now: number) => {
          raf = 0
          if (!isVisible()) return // off-screen: pause the loop
          if (now - last < 33) {
            raf = requestAnimationFrame(frame)
            return
          }
          last = now
          const phase = (now * 0.0002) % 1
          paintField(buffer, cols, rows, fill, phase, matrix, pulse)
          imageData = putRasterBuffer(ctx, buffer, imageData)
          raf = requestAnimationFrame(frame)
        }
        wakeRef.current = () => {
          if (!raf) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      }

      teardownRef.current = () => {
        if (raf) cancelAnimationFrame(raf)
      }
    })

    return () => {
      // Invalidate this closure so a prop-changed re-init doesn't double-run.
      restartToken.current = token + 1
      cancelAnimationFrame(sched)
      teardownRef.current?.()
      teardownRef.current = undefined
      wakeRef.current = undefined
    }
  }, [color, seed, cell, pulse, matrix, isVisible])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        imageRendering: "pixelated",
        width: "100%",
        height: "100%",
        display: "block",
      }}
      aria-hidden="true"
    />
  )
}
