"use client";

import { useRef, useState } from "react";

import { DitherSlider } from "./DitherSlider";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

const RATES = [1, 1.25, 1.5, 2];

/** `m:ss` from seconds. Verbatim port of the Vue setup-scope `fmt`. */
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Shared control-button chrome. Constant — hoisted to module scope (Vue's
 *  `computed` `btn` had no reactive reads). */
const BTN = cn(
  "grid size-8 place-items-center rounded-md text-[12px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
  CONTROL_BUTTON,
);

export interface DitherVideoPlayerProps {
  src?: string;
  poster?: string;
  label?: string;
  color?: PixelColor;
  className?: string;
}

/**
 * DitherVideoPlayer — native `<video>` under dither chrome: play/pause, a
 * dithered scrubber, volume, playback rate, mute, fullscreen, and player
 * keyboard. Verbatim port of DitherVideoPlayer.vue.
 *
 * The scrubber and volume are the ported `DitherSlider` (composed, not
 * reimplemented): Vue `<DitherSlider :model-value="…" @update:model-value>`
 * → `<DitherSlider value={…} onChange={…}>` (guide §4). The slider emits a
 * `number | [number, number]`; the handlers narrow with `typeof … === "number"`
 * exactly as the Vue originals.
 *
 * Player keyboard — skipped while a control inside owns the key: Space/K play
 * · ←→ seek 5s · ↑↓ volume · M mute · F fullscreen. No `src` renders an honest
 * empty face so previews never look broken.
 *
 * State that affects rendered output (`playing`, `muted`, `time`, `duration`,
 * `volume`, `rate`) lives in `useState` — the `<video>` element itself and the
 * fullscreen host are DOM-handle refs. The video API (`play()`, `currentTime`,
 * `requestFullscreen`) is only reached inside handlers, so SSR never touches it.
 */
export function DitherVideoPlayer({
  src,
  poster,
  label = "Video",
  color = "blue",
  className,
}: DitherVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);

  function toggle(): void {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function seek(t: number | [number, number]): void {
    const v = videoRef.current;
    if (v && typeof t === "number") v.currentTime = t;
  }

  function toggleMute(): void {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  /** Imperatively sets the element's volume; the `volumechange` event mirrors
   *  it back into state. Named `applyVolume` to avoid clashing with the
   *  `setVolume` state setter. */
  function applyVolume(value: number | [number, number]): void {
    const el = videoRef.current;
    if (!el || typeof value !== "number") return;
    el.volume = Math.min(1, Math.max(0, value));
    el.muted = el.volume === 0;
  }

  function cycleRate(): void {
    const el = videoRef.current;
    if (!el) return;
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    el.playbackRate = next;
    setRate(next);
  }

  function bump(delta: number): void {
    const el = videoRef.current;
    if (el) applyVolume(el.volume + delta);
  }

  function nudge(delta: number): void {
    const el = videoRef.current;
    if (el)
      el.currentTime = Math.min(duration, Math.max(0, el.currentTime + delta));
  }

  function fullscreen(): void {
    void hostRef.current?.requestFullscreen();
  }

  /** Player keyboard — skipped while a control inside owns the key. */
  function onKey(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (!src || !videoRef.current) return;
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
    if (tag === "INPUT" || target.getAttribute("role") === "slider") return;
    const k = e.key.toLowerCase();
    if (e.key === " " || k === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(5);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      bump(0.1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      bump(-0.1);
    } else if (k === "m") {
      toggleMute();
    } else if (k === "f") {
      fullscreen();
    }
  }

  const timeLabel = `${fmt(time)} / ${fmt(duration)}`;

  return (
    <div
      ref={hostRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-background/80 font-mono",
        CONTROL_BUTTON,
        className,
      )}
      onKeyDown={onKey}
    >
      <div className="relative aspect-video bg-background">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            aria-label={label}
            className="h-full w-full object-contain"
            playsInline
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={() => setTime(videoRef.current?.currentTime ?? 0)}
            onDurationChange={() =>
              setDuration(videoRef.current?.duration ?? 0)
            }
            onVolumeChange={() => {
              setMuted(videoRef.current?.muted ?? false);
              setVolume(videoRef.current?.volume ?? 1);
            }}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            aria-hidden="true"
          >
            <div className="text-center">
              <span className="mx-auto block size-3 rounded-[2px] bg-border" />
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                No source.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="grid gap-1.5 border-t border-border/60 p-2">
        <DitherSlider
          value={time}
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          label="Seek"
          color={color}
          disabled={!src}
          className="w-full"
          onChange={seek}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={BTN}
            aria-label={playing ? "Pause" : "Play"}
            disabled={!src}
            onClick={toggle}
          >
            <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
          </button>
          <button
            type="button"
            className={BTN}
            aria-label={muted ? "Unmute" : "Mute"}
            disabled={!src}
            onClick={toggleMute}
          >
            <span aria-hidden="true">{muted ? "○" : "●"}</span>
          </button>
          <DitherSlider
            value={muted ? 0 : volume}
            min={0}
            max={1}
            step={0.05}
            label="Volume"
            color={color}
            disabled={!src}
            className="w-20"
            onChange={applyVolume}
          />
          <button
            type="button"
            className={cn(BTN, "w-10 text-[10px] tabular-nums")}
            aria-label={`Playback speed ${rate}x`}
            disabled={!src}
            onClick={cycleRate}
          >
            {rate}×
          </button>
          <span className="px-1.5 text-[10px] tabular-nums text-muted-foreground">
            {timeLabel}
          </span>
          <button
            type="button"
            className={cn(BTN, "ml-auto")}
            aria-label="Fullscreen"
            disabled={!src}
            onClick={fullscreen}
          >
            <span aria-hidden="true">⛶</span>
          </button>
        </div>
      </div>
    </div>
  );
}
