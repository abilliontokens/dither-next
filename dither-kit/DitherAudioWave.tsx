"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { rgb, type Rgb } from "./palette";
import {
  BAYER4,
  fillOf,
  fnv1a,
  xorshift32,
  pixelPrefersReducedMotion,
  type PixelColor,
} from "./pixel";
import { useCanvasVisibility } from "./use-visibility";

const CELL = 2;
const BAR_COUNT = 96;
const SEEK_STEP = 5;
const SEEK_STEP_COARSE = 30;

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Paint the waveform as dithered vertical bars. Each bar is a stack of 2-CSS-px
 * cells; a cell is lit when its `BAYER4` threshold falls under the bar's fill
 * density, so the bars read in the kit's ordered-dither grain rather than as
 * solid alpha rectangles. Played bars use the accent ramp at high density;
 * unplayed bars use the muted rail at low density. A faint centre axis threads
 * the track. Mirrors the canvas lifecycle of `DitherSlider` (1 device-px per
 * cell, stretched with `image-rendering: pixelated`).
 */
function paintWave(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  peaks: number[],
  posRatio: number,
  accent: Rgb,
  muted: Rgb,
): void {
  ctx.clearRect(0, 0, cols, rows);
  const cy = rows / 2;
  const playCol = Math.round(cols * posRatio);
  for (let x = 0; x < cols; x++) {
    const p = peaks[Math.min(peaks.length - 1, Math.floor((x / cols) * peaks.length))] ?? 0;
    const half = p * (cy - 1);
    const played = x < playCol;
    const color = played ? accent : muted;
    const density = played ? 0.82 : 0.34;
    for (let y = 0; y < rows; y++) {
      const dist = Math.abs(y - cy);
      if (dist > half) continue;
      const lit = BAYER4[y & 3][x & 3] < density;
      ctx.fillStyle = rgb(color, 1, lit ? (played ? 0.95 : 0.6) : 0.12);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Faint centre axis so the waveform reads as mirrored even at low peaks.
  ctx.fillStyle = rgb(muted, 1, 0.28);
  ctx.fillRect(0, Math.floor(cy), cols, 1);
}

export interface DitherAudioWaveProps {
  /** Bar heights in [0, 1]. When omitted, deterministic seeded peaks are
   *  generated (xorshift32 of an fnv1a hash of `src`/`seed`) so SSR and client
   *  agree — never `Math.random`. */
  peaks?: number[];
  /** Current playback position in seconds (controlled visual; used when no
   *  `src`, or to externally scrub a `src` instance). */
  value?: number;
  /** Total duration in seconds (controlled; used when no `src`). */
  duration?: number;
  /** Fired on every seek (drag, click, keyboard). */
  onSeek?: (time: number) => void;
  /** When set, the component mounts a real `<audio>` and owns play/pause/time. */
  src?: string;
  /** Bar accent colour (kit `PixelColor`). */
  color?: PixelColor;
  /** Deterministic seed for generated peaks (defaults to a hash of `src`). */
  seed?: number | string;
  /** Fired when playback starts/stops (src mode only). */
  onPlayingChange?: (playing: boolean) => void;
  /** Accessible name for the scrubber. */
  label?: string;
  className?: string;
}

/**
 * DitherAudioWave — waveform scrubber. Renders `peaks` (or a deterministic
 * seeded placeholder so SSR and the client paint identically) as ordered-dither
 * bars on a `<canvas>`; the played region uses the accent ramp, unplayed the
 * muted rail. Click/drag seeks; hover shows a time tooltip.
 *
 * Two modes share one surface:
 *  - `src` set: a real `<audio>` element is mounted; the component owns
 *    play/pause and reads `currentTime`. While playing, an rAF loop repaints
 *    the playhead directly from `audio.currentTime` (no per-frame React state)
 *    so the scrubber stays smooth; the loop is gated by `useCanvasVisibility`
 *    so an off-screen wave costs nothing.
 *  - no `src`: a pure controlled visual driven by `value`/`duration`/`onSeek`.
 *
 * The track is a `role="slider"` with `aria-valuetext` as a `m:ss` time string
 * and arrow-key seeking (Shift = coarse, Home/End = bounds). The canvas
 * lifecycle (mount/resize/visibility/teardown) follows `DitherSlider`; the rAF
 * loop is torn down in the same effect that creates it.
 */
export function DitherAudioWave({
  peaks: peaksProp,
  value,
  duration,
  onSeek,
  src,
  color = "blue",
  seed,
  onPlayingChange,
  label = "Audio scrubber",
  className,
}: DitherAudioWaveProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reactId = useId();

  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  const accentRgb = useMemo<Rgb>(() => fillOf(color), [color]);
  const mutedRgb = useMemo<Rgb>(() => fillOf("grey"), []);

  const peaks = useMemo<number[]>(() => {
    if (peaksProp && peaksProp.length) return peaksProp;
    const key =
      seed !== undefined ? String(seed) : src ?? "dither-audio-wave";
    const r = xorshift32(fnv1a(key) || 1);
    return Array.from({ length: BAR_COUNT }, () => 0.08 + r() * 0.92);
  }, [peaksProp, seed, src]);

  const displayPos = src ? audioTime : value ?? 0;
  const displayDur = src ? audioDuration : duration ?? 0;
  const posRatio = displayDur > 0 ? Math.min(1, displayPos / displayDur) : 0;

  const visible = useCanvasVisibility(rootRef);

  function paint(ratio: number): void {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;
    const box = root.getBoundingClientRect();
    const cols = peaks.length;
    const rows = Math.max(10, Math.round(box.height / CELL));
    if (canvas.width !== cols || canvas.height !== rows) {
      canvas.width = cols;
      canvas.height = rows;
    }
    paintWave(ctx, cols, rows, peaks, ratio, accentRgb, mutedRgb);
  }

  // Repaint on state/prop change (non-playing). The rAF loop below owns the
  // smooth playhead while `src` playback is active.
  useEffect(() => {
    if (isPlaying) return; // rAF loop owns painting while playing
    paint(posRatio);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      ro = new ResizeObserver(() => paint(posRatio));
      ro.observe(rootRef.current);
    }
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posRatio, peaks, accentRgb, mutedRgb, isPlaying, displayDur]);

  // rAF playhead loop — only while a src is playing. Reads currentTime straight
  // off the audio element (no per-frame state); throttles a state bump for the
  // slider's aria/tooltip. Torn down on pause/unmount.
  useEffect(() => {
    if (!src || !isPlaying) return;
    let raf = 0;
    let lastBump = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const audio = audioRef.current;
      if (!audio) return;
      const dur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : displayDur;
      const ratio = dur > 0 ? Math.min(1, audio.currentTime / dur) : 0;
      if (visible()) paint(ratio);
      const now = performance.now();
      if (now - lastBump > 230) {
        lastBump = now;
        setAudioTime(audio.currentTime);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, isPlaying, displayDur, peaks, accentRgb, mutedRgb]);

  // Wire the real <audio> events (loadedmetadata / timeupdate / ended).
  useEffect(() => {
    if (!src) return;
    const audio = audioRef.current;
    if (!audio) return;
    function onMeta(): void {
      const el = audioRef.current;
      if (el && el.duration && Number.isFinite(el.duration)) setAudioDuration(el.duration);
    }
    function onTime(): void {
      if (isPlaying) return;
      const el = audioRef.current;
      if (el) setAudioTime(el.currentTime);
    }
    function onEnd(): void {
      setIsPlaying(false);
      onPlayingChange?.(false);
    }
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function seek(t: number): void {
    const clamped = Math.max(0, Math.min(displayDur, t));
    const audio = audioRef.current;
    if (src && audio) {
      audio.currentTime = clamped;
      setAudioTime(clamped);
    }
    onSeek?.(clamped);
  }

  function clientToTime(clientX: number): number {
    const rect = rootRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return ratio * displayDur;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seek(clientToTime(e.clientX));
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const t = clientToTime(e.clientX);
    setHoverTime(t);
    if (dragging && e.currentTarget.hasPointerCapture(e.pointerId)) seek(t);
  }
  function onPointerUp(): void {
    setDragging(false);
  }

  function onKeydown(e: KeyboardEvent<HTMLDivElement>): void {
    const coarse = e.shiftKey ? SEEK_STEP_COARSE : SEEK_STEP;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") seek(displayPos + coarse);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") seek(displayPos - coarse);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(displayDur);
    else return;
    e.preventDefault();
  }

  function togglePlay(): void {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
      onPlayingChange?.(true);
    } else {
      audio.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
    }
  }

  const hoverLeft =
    hoverTime !== null && displayDur > 0 ? `${(hoverTime / displayDur) * 100}%` : "0%";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {src ? (
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            CONTROL_BUTTON,
            "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-background",
          )}
          onClick={togglePlay}
        >
          <span aria-hidden="true">{isPlaying ? "❚❚" : "▶"}</span>
        </button>
      ) : null}

      <div
        ref={rootRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(displayDur)}
        aria-valuenow={Math.round(displayPos)}
        aria-valuetext={`${formatTime(displayPos)} of ${formatTime(displayDur)}`}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        tabIndex={0}
        className="relative h-12 flex-1 cursor-pointer touch-none select-none rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHoverTime(null)}
        onKeyDown={onKeydown}
        id={`${reactId}-track`}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Playhead marker */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
          style={{ left: `${posRatio * 100}%`, transition: still ? "none" : "left 80ms linear" }}
        />
        {/* Hover time tooltip */}
        {hoverTime !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground"
            style={{ left: hoverLeft }}
          >
            {formatTime(hoverTime)}
          </div>
        ) : null}
      </div>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {formatTime(displayPos)} / {formatTime(displayDur)}
      </span>

      {src ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      ) : null}
    </div>
  );
}
