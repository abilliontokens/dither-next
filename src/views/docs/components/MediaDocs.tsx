"use client";

import { useState } from "react";

import { DitherAudioWave, DitherBracket, DitherSchedule, DitherVideoPlayer, type BracketMatch } from "@dither-kit";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/* Public-domain sample clip (MDN CC0) — swap for your own src. */
const VIDEO_SRC = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const SNIPPET_AUDIO = `<DitherAudioWave color="blue" duration={30} seed={42} label="Waveform" />
{/* no peaks = deterministic seeded bars (SSR-stable); set src to mount a real
    <audio> and own play/pause, or drive value/duration/onSeek yourself */}`;

const API: Record<string, PropRow[]> = {
  video: [
    { prop: "src", type: "string — no src renders an honest empty face", default: "undefined" },
    { prop: "poster", type: "string", default: "undefined" },
    { prop: "label", type: "string — accessible name", default: '"Video"' },
    { prop: "color", type: "PixelColor — scrubber and volume hue", default: '"blue"' },
    { prop: "keyboard", type: "Space/K play · ←→ seek 5s · ↑↓ volume · M mute · F fullscreen", default: "—" },
  ],
  bracket: [
    { prop: "rounds", type: "{ a, b, winner? }[][] — columns left to right", default: "required" },
    { prop: "color", type: "PixelColor — winner accent", default: '"green"' },
    { prop: "interactive", type: "boolean — click a side to pick", default: "false" },
    { prop: "onPick", type: "(round, match, side) — consumer advances the data", default: "—" },
  ],
  schedule: [
    { prop: "events", type: "{ start, end, label, color? }[] — fractional hours", default: "required" },
    { prop: "from / to", type: "number — day window", default: "8 / 18" },
    { prop: "now", type: "number — draws the now line; omit to hide", default: "undefined" },
  ],
  audio: [
    { prop: "peaks", type: "number[] (0..1) — omit for seeded", default: "seeded" },
    { prop: "src", type: "string — mounts a real <audio>", default: "undefined" },
    { prop: "value", type: "number — playback position (s)", default: "0" },
    { prop: "duration", type: "number (s)", default: "undefined" },
    { prop: "color", type: "PixelColor — bar accent", default: '"blue"' },
    { prop: "seed", type: "number | string — peak seed", default: "hash of src" },
    { prop: "onSeek", type: "(time: number)", default: "—" },
  ],
};

const SNIPPET_VIDEO = `<DitherVideoPlayer
  src="/clips/launch.mp4"
  label="Launch recap"
  color="blue"
/>
{/* native <video> under dither chrome: play · dithered scrubber ·
    tabular time · mute · fullscreen. No src = honest empty face. */}`;

const SNIPPET_BRACKET = `<DitherBracket rounds={rounds} interactive onPick={pick} />

function pick(r, m, side) {          // you own the data — advance the winner
  const match = rounds[r][m]
  match.winner = side
  const next = rounds[r + 1]?.[Math.floor(m / 2)]
  if (next) m % 2 === 0 ? (next.a = win(match)) : (next.b = win(match))
}`;

const SNIPPET_SCHEDULE = `<DitherSchedule
  events={[
    { start: 9, end: 10.5, label: 'Standup', color: 'blue' },
    { start: 11, end: 12.5, label: 'Design review', color: 'purple' },
    { start: 14, end: 16, label: 'Focus block', color: 'green' },
  ]}
  from={8} to={18} now={13.5}
/>
{/* fractional hours: 13.5 is half past one */}`;

const SCHEDULE_EVENTS = [
  { start: 9, end: 10.5, label: "Standup", color: "blue" as const },
  { start: 11, end: 12.5, label: "Design review", color: "purple" as const },
  { start: 14, end: 16, label: "Focus block", color: "green" as const },
  { start: 16.5, end: 17.5, label: "Client call", color: "orange" as const },
];

export function MediaDocs() {
  /* Bracket: picking a winner advances them into the next round. */
  const [rounds, setRounds] = useState<BracketMatch[][]>([
    [
      { a: "Bayer", b: "Ordered" },
      { a: "Halftone", b: "Threshold" },
    ],
    [{ a: "—", b: "—" }],
  ]);
  function pick(r: number, m: number, side: "a" | "b") {
    setRounds((prev) => {
      const next = prev.map((round) => round.map((mt) => ({ ...mt })));
      const match = next[r][m];
      match.winner = side;
      const winner = side === "a" ? match.a : match.b;
      const nxt = next[r + 1]?.[Math.floor(m / 2)];
      if (nxt) {
        if (m % 2 === 0) nxt.a = winner;
        else nxt.b = winner;
      }
      return next;
    });
  }
  function resetBracket() {
    setRounds([
      [
        { a: "Bayer", b: "Ordered" },
        { a: "Halftone", b: "Threshold" },
      ],
      [{ a: "—", b: "—" }],
    ]);
  }

  const [scheduleNow, setScheduleNow] = useState(13.5);

  return (
    <>
      {/* Video player */}
      <section id="video-player" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Video player</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A native video under dither chrome — play, a dithered scrubber that really
          seeks, a volume slider, playback speed, mute, fullscreen, and player keyboard
          (Space, arrows, M, F). Without a source it shows an honest empty face instead
          of a broken box.
        </p>
        <DemoCard code={SNIPPET_VIDEO}>
          <div className="mx-auto max-w-md">
            <DitherVideoPlayer src={VIDEO_SRC} label="Flower sample clip" color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={API.video} />
      </section>

      {/* Bracket */}
      <section id="bracket" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Bracket</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A knockout bracket — winners carry the accent, losers strike through, connector
          rails bridge the rounds. This one is interactive: pick every winner and the
          final fills itself.
        </p>
        <DemoCard code={SNIPPET_BRACKET}>
          <div className="grid place-items-center gap-3">
            <DitherBracket rounds={rounds} interactive color="green" onPick={pick} />
            <button
              type="button"
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={resetBracket}
            >
              Reset bracket
            </button>
          </div>
        </DemoCard>
        <PropsTable rows={API.bracket} />
      </section>

      {/* Schedule */}
      <section id="schedule" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Schedule</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A day timeline — events sit proportionally on the hour rail, each with its
          swatch rail, and the red now line slides as the day moves. Drag the hour to
          move time.
        </p>
        <DemoCard code={SNIPPET_SCHEDULE}>
          <div className="mx-auto max-w-md">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              now
              <input
                type="range"
                min={8}
                max={18}
                step={0.25}
                className="w-40 accent-[var(--accent)]"
                value={scheduleNow}
                onChange={(e) => setScheduleNow(Number(e.target.value))}
              />
              <span className="tabular-nums">
                {Math.floor(scheduleNow)}:{String(Math.round((scheduleNow % 1) * 60)).padStart(2, "0")}
              </span>
            </label>
            <DitherSchedule className="mt-3" events={SCHEDULE_EVENTS} from={8} to={18} now={scheduleNow} />
          </div>
        </DemoCard>
        <PropsTable rows={API.schedule} />
      </section>
      <section id="audio-wave" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Audio wave</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A waveform scrubber — bar heights render as ordered-dither cells (played in
          the accent ramp, unplayed in the muted rail), with click/drag seeking and a
          time tooltip. Omit peaks for a deterministic seeded placeholder so server and
          client paint identically; set src to mount a real audio element.
        </p>
        <DemoCard code={SNIPPET_AUDIO}>
          <div className="mx-auto max-w-md">
            <DitherAudioWave color="blue" duration={30} seed={42} label="Waveform" />
          </div>
        </DemoCard>
        <PropsTable rows={API.audio} />
      </section>

    </>
  );
}
