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
import { revealFromSeed, colNoise } from "./dither-paint"
import {
  BAYER4,
  fillOf,
  type PixelColor,
  pixelMatrixFromSeed,
  pixelPrefersReducedMotion,
} from "./pixel"
import { useCanvasVisibility } from "./use-visibility"

const CELL = 2

/** Paint one frame of the flood reveal. The fill sweeps in from the seeded
 * direction; jitter scatters the leading edge so it develops like a photo
 * rather than a hard line. Cells behind the edge fill solid; cells ahead
 * stay empty. The Bayer matrix dithers the transition band. */
function paintFlood(
  buf: RasterBuffer,
  cols: number,
  rows: number,
  fill: Rgb,
  progress: number,
  matrix: number[][],
  p: { reverse: boolean; jitter: number }
): void {
  clearRasterBuffer(buf)
  const edge = p.reverse ? 1 - progress : progress
  for (let x = 0; x < cols; x++) {
    // Per-column noise scatters the reveal edge, seeded so the same seed
    // always develops the same way.
    const noise = p.jitter > 0 ? colNoise(x, 42) * p.jitter : 0
    const colEdge = Math.max(0, Math.min(1, edge + noise - p.jitter * 0.5))
    const fillRow = Math.floor(colEdge * rows)
    for (let y = 0; y < rows; y++) {
      if (p.reverse ? y >= rows - fillRow : y < fillRow) {
        // Behind the edge: solid fill.
        setOrBlendRasterPixel(buf, x, y, fill, 0.85)
      } else if (y === fillRow || y === fillRow + 1) {
        // Transition band: dither the leading edge.
        const t = y - fillRow
        const bright = Math.max(0, 1 - t * 0.5)
        if (bright > matrix[y & 3][x & 3]) {
          setOrBlendRasterPixel(buf, x, y, fill, bright * 0.7)
        }
      }
    }
  }
}

export interface DitherPixelFloodProps {
  color?: PixelColor
  seed?: number
  cell?: number
  duration?: number
  className?: string
}

/**
 * A seeded reveal sweep fill - an entrance animation. The dither fill develops
 * like a photo: jitter scatters the leading edge so it never reads as a hard
 * line, and the seeded direction/matrix make one seed always develop the same
 * way. The RAF loop runs the entrance once, then stops (no idle loop).
 */
export function DitherPixelFlood({
  color = "blue",
  seed = 1984,
  cell = CELL,
  duration = 900,
  className,
}: DitherPixelFloodProps) {
  const reveal = useMemo(() => revealFromSeed(seed), [seed])
  const matrix = useMemo(
    () => (seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4),
    [seed]
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // `wake` is set by the effect to a function that restarts the RAF loop; the
  // visibility hook calls it when the canvas re-enters the viewport.
  const wakeRef = useRef<(() => void) | undefined>(undefined)
  const restartToken = useRef(0)
  // Pause the entrance while scrolled/panned off-screen; resume on re-entry.
  const isVisible = useCanvasVisibility(canvasRef, () => wakeRef.current?.())

  useEffect(() => {
    const token = ++restartToken.current
    // Defer the measure + first paint to a RAF so many components mounting at
    // once don't force a sync layout reflow (beats nextTick in Vue).
    const deferRaf = requestAnimationFrame(() => {
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
      let start = 0
      let done = false
      const buffer = createRasterBuffer(cols, rows)
      let imageData: ImageData | undefined

      // Paint the first frame (progress 0) immediately so the canvas reads
      // instantly, even when reduced-motion skips the entrance.
      paintFlood(buffer, cols, rows, fill, 0, matrix, reveal)
      imageData = putRasterBuffer(ctx, buffer, imageData)

      wakeRef.current = undefined
      const animate = !pixelPrefersReducedMotion()
      if (animate) {
        const frame = (now: number) => {
          raf = 0
          if (!isVisible()) return // off-screen: pause the loop
          if (!start) start = now
          const elapsed = now - start
          const progress = Math.min(1, elapsed / duration)
          if (!done) {
            paintFlood(buffer, cols, rows, fill, progress, matrix, reveal)
            imageData = putRasterBuffer(ctx, buffer, imageData)
            if (progress >= 1) done = true
          }
          // The loop completes then stops - no idle rAF once the entrance is
          // done. OnWake reschedules the same closure if it paused mid-flight.
          if (!done) raf = requestAnimationFrame(frame)
        }
        wakeRef.current = () => {
          if (!raf && !done) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      }
    })

    return () => {
      // Invalidate this closure so a prop-changed re-init doesn't double-run.
      restartToken.current = token + 1
      cancelAnimationFrame(deferRaf)
      wakeRef.current = undefined
    }
  }, [color, seed, cell, duration, reveal, matrix, isVisible])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        imageRendering: "pixelated",
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  )
}
