"use client";

import { useRef } from "react";

import {
  DitherPulseField,
  DitherPixelFlood,
  DitherParticleBurst,
  DitherTypeStream,
  DitherSpotlight,
  DitherMagnetic,
  DitherTilt,
  DitherDissolve,
  DitherGlyphTrail,
  DitherScanProgress,
  type DitherDissolveHandle,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

const SNIPPET_PULSE_FIELD = `<DitherPulseField color="blue" seed={42} cell={3} class="h-[200px] w-full" />`;
const SNIPPET_PIXEL_FLOOD = `<DitherPixelFlood
  color="blue"
  seed={1984}
  cell={2}
  duration={900}
  className="h-[200px] w-full"
/>`;
const SNIPPET_PARTICLE_BURST = `{/* click the canvas to trigger a burst */}
<DitherParticleBurst
  color="blue"
  seed={7}
  gravity={0.0002}
  className="h-[200px] w-full"
/>`;

const SNIPPET_TYPE_STREAM = `<DitherTypeStream
  text="dither-ui"
  seed={42}
  speed={1}
  cursor={true}
/>`;

const SNIPPET_SPOTLIGHT = `<DitherSpotlight seed={42} color="var(--foreground)">
  Hover me
</DitherSpotlight>`;

const SNIPPET_MAGNETIC = `<DitherMagnetic seed={42} strength={0.3} radius={150}>
  Hover me
</DitherMagnetic>`;

const SNIPPET_TILT = `<DitherTilt seed={42} max={12} scale={1.02} perspective={600}>
  <div className="flex h-40 w-64 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
    Tilt me
  </div>
</DitherTilt>`;

const SNIPPET_DISSOLVE = `<DitherDissolve seed={1984} cols={16} duration={700}>
  <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border/60 bg-muted/40">
    Dissolved content
  </div>
</DitherDissolve>`;

const SNIPPET_GLYPH_TRAIL = `<DitherGlyphTrail seed={42} maxStamps={20} lifetime={500}>
  Move your cursor here
</DitherGlyphTrail>`;

const SNIPPET_SCAN_PROGRESS = `<DitherScanProgress
  seed={42}
  width={120}
  height={40}
/>`;

const API: Record<string, PropRow[]> = {
  pulseField: [
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "seed", type: "number", default: "42" },
    { prop: "cell", type: "number", default: "3" },
    { prop: "class", type: "string", default: "undefined" },
  ],
  pixelFlood: [
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "seed", type: "number", default: "1984" },
    { prop: "cell", type: "number", default: "2" },
    { prop: "duration", type: "number", default: "900" },
    { prop: "className", type: "string", default: "undefined" },
  ],
  particleBurst: [
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "seed", type: "number", default: "7" },
    { prop: "gravity", type: "number", default: "0.0002" },
    { prop: "className", type: "string", default: "undefined" },
  ],
  typeStream: [
    { prop: "text", type: "string", default: '""' },
    { prop: "seed", type: "number", default: "42" },
    { prop: "speed", type: "number", default: "1" },
    { prop: "cursor", type: "boolean", default: "true" },
    { prop: "className", type: "string", default: "undefined" },
  ],
  spotlight: [
    { prop: "seed", type: "number", default: "42" },
    { prop: "color", type: "string", default: '"var(--foreground)"' },
    { prop: "className", type: "string", default: "undefined" },
    { prop: "children", type: "React.ReactNode", default: "undefined" },
  ],
  magnetic: [
    { prop: "seed", type: "number", default: "42" },
    { prop: "strength", type: "number", default: "0.3" },
    { prop: "radius", type: "number", default: "150" },
    { prop: "className", type: "string", default: "undefined" },
    { prop: "children", type: "React.ReactNode", default: "undefined" },
  ],
  tilt: [
    { prop: "seed", type: "number", default: "42" },
    { prop: "max", type: "number", default: "12" },
    { prop: "scale", type: "number", default: "1.02" },
    { prop: "perspective", type: "number", default: "600" },
    { prop: "className", type: "string", default: "undefined" },
    { prop: "children", type: "React.ReactNode", default: "undefined" },
  ],
  dissolve: [
    { prop: "seed", type: "number", default: "1984" },
    { prop: "cols", type: "number", default: "16" },
    { prop: "duration", type: "number", default: "700" },
    { prop: "className", type: "string", default: "undefined" },
    { prop: "children", type: "React.ReactNode | ((show: boolean) => React.ReactNode)", default: "undefined" },
  ],
  glyphTrail: [
    { prop: "seed", type: "number", default: "42" },
    { prop: "color", type: "string", default: '"var(--foreground)"' },
    { prop: "maxStamps", type: "number", default: "20" },
    { prop: "lifetime", type: "number", default: "500" },
    { prop: "className", type: "string", default: "undefined" },
    { prop: "children", type: "React.ReactNode", default: "undefined" },
  ],
  scanProgress: [
    { prop: "progress", type: "number", default: "undefined" },
    { prop: "seed", type: "number", default: "42" },
    { prop: "color", type: "string", default: '"var(--foreground)"' },
    { prop: "trackColor", type: "string", default: '"var(--border)"' },
    { prop: "width", type: "number", default: "120" },
    { prop: "height", type: "number", default: "40" },
    { prop: "className", type: "string", default: "undefined" },
  ],
};

export function GenerativeDocs() {
  const dissolveRef = useRef<DitherDissolveHandle>(null);

  return (
    <>
      {/* Pulse Field */}
      <section id="pulse-field" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pulse Field</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A seeded radial-wave pulse field rendered to a pixelated canvas. One
          seed picks the center, wave count, speed, and falloff; the fill color
          is the single dither color, varied only by alpha against a seeded
          Bayer matrix.
        </p>
        <DemoCard code={SNIPPET_PULSE_FIELD}>
          <DitherPulseField color="blue" seed={42} cell={3} class="h-[200px] w-full" />
        </DemoCard>
        <PropsTable rows={API.pulseField} />
      </section>

      {/* Pixel Flood */}
      <section id="pixel-flood" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pixel Flood</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A seeded reveal-sweep fill that develops like a photo: jitter
          scatters the leading edge so it never reads as a hard line. The
          seeded direction and matrix make one seed always develop the same
          way. The entrance runs once, then the loop stops.
        </p>
        <DemoCard code={SNIPPET_PIXEL_FLOOD}>
          <DitherPixelFlood
            color="blue"
            seed={1984}
            cell={2}
            duration={900}
            className="h-[200px] w-full"
          />
        </DemoCard>
        <PropsTable rows={API.pixelFlood} />
      </section>

      {/* Particle Burst */}
      <section id="particle-burst" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Particle Burst</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A click-triggered particle burst on a low-res canvas. Each click
          spawns a seeded explosion of glyph particles (dot, plus, x, streak,
          asterisk) that fly outward, fall under gravity, and fade. The RAF
          loop runs only while particles are alive.
        </p>
        <DemoCard code={SNIPPET_PARTICLE_BURST}>
          <p className="mb-3 text-center text-[12px] text-muted-foreground">
            Click the canvas to trigger a burst
          </p>
          <DitherParticleBurst
            color="blue"
            seed={7}
            gravity={0.0002}
            className="h-[200px] w-full"
          />
        </DemoCard>
        <PropsTable rows={API.particleBurst} />
      </section>

      {/* Type Stream */}
      <section id="type-stream" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Type Stream</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A typewriter that streams text in character by character with a
          dithered cursor block. Per-character timing is jittered from the seed
          via mulberry32 so the pacing feels organic. Honors
          prefers-reduced-motion by showing the full text immediately.
        </p>
        <DemoCard code={SNIPPET_TYPE_STREAM}>
          <div className="mx-auto max-w-sm">
            <DitherTypeStream text="dither-ui" seed={42} speed={1} cursor={true} />
          </div>
        </DemoCard>
        <PropsTable rows={API.typeStream} />
      </section>

      {/* Spotlight */}
      <section id="spotlight" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Spotlight</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A cursor-following spotlight that dims outside its cone and casts a
          faint glow at the pointer. Radius, falloff, and dim strength are
          derived from the seed so each instance has a distinct beam shape. The
          cone tracks the pointer with a RAF-driven lerp for smooth motion.
        </p>
        <DemoCard code={SNIPPET_SPOTLIGHT}>
          <DitherSpotlight seed={42} color="var(--foreground)">
            <div className="flex h-[200px] w-full items-center justify-center rounded-lg border border-border/60 text-lg tracking-tight">
              Hover me
            </div>
          </DitherSpotlight>
        </DemoCard>
        <PropsTable rows={API.spotlight} />
      </section>

      {/* Magnetic */}
      <section id="magnetic" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Magnetic</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Magnetic pull on hover. The wrapped content drifts toward the cursor
          when the pointer is within radius of the element center, with
          strength falling off by distance. It eases toward the target offset
          each frame via RAF lerp and settles back to rest using a seeded
          cubic-bezier transition.
        </p>
        <DemoCard code={SNIPPET_MAGNETIC}>
          <DitherMagnetic seed={42} strength={0.3} radius={150}>
            <div className="flex h-[200px] w-full items-center justify-center rounded-lg border border-border/60 text-lg tracking-tight">
              Hover me
            </div>
          </DitherMagnetic>
        </DemoCard>
        <PropsTable rows={API.magnetic} />
      </section>

      {/* Tilt */}
      <section id="tilt" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tilt</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          3D tilt-on-hover parallax. The card rotates toward and away from the
          cursor, easing toward the target rotation each frame via RAF lerp,
          and lifts with a slight scale while active. On leave it settles back
          to flat using a seeded cubic-bezier transition.
        </p>
        <DemoCard code={SNIPPET_TILT}>
          <div className="flex h-[200px] items-center justify-center">
            <DitherTilt seed={42} max={12} scale={1.02} perspective={600}>
              <div className="flex h-40 w-64 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-lg tracking-tight">
                Tilt me
              </div>
            </DitherTilt>
          </div>
        </DemoCard>
        <PropsTable rows={API.tilt} />
      </section>

      {/* Dissolve */}
      <section id="dissolve" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Dissolve</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A pixel-dissolve transition. A grid of cells fades out in seeded
          order (per-cell animation-delay), revealing the content beneath. The
          trigger method re-runs the dissolve on demand, for example on tab
          change.
        </p>
        <DemoCard code={SNIPPET_DISSOLVE}>
          <button
            type="button"
            className="mb-3 rounded-lg border border-border/60 px-4 py-2 text-[12px] text-foreground transition-colors hover:bg-muted/40"
            onClick={() => dissolveRef.current?.trigger()}
          >
            Re-run dissolve
          </button>
          <DitherDissolve ref={dissolveRef} seed={1984} cols={16} duration={700}>
            <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-lg tracking-tight">
              Dissolved content
            </div>
          </DitherDissolve>
        </DemoCard>
        <PropsTable rows={API.dissolve} />
      </section>

      {/* Glyph Trail */}
      <section id="glyph-trail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Glyph Trail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A cursor trail of seeded dithered glyph SVG stamps. Each stamp is a
          Glyph (dot, plus, x, streak, asterisk) from glyphFromSeed, fading
          over its lifetime. A requestAnimationFrame loop runs only while stamps
          remain, then stops.
        </p>
        <DemoCard code={SNIPPET_GLYPH_TRAIL}>
          <DitherGlyphTrail seed={42} maxStamps={20} lifetime={500}>
            <div className="flex h-[200px] w-full items-center justify-center rounded-lg border border-border/60 text-lg tracking-tight">
              Move your cursor here
            </div>
          </DitherGlyphTrail>
        </DemoCard>
        <PropsTable rows={API.glyphTrail} />
      </section>

      {/* Scan Progress */}
      <section id="scan-progress" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Scan Progress</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An SVG progress path drawn along an S-curve with a seeded dash
          pattern. Tracks window scroll when progress is undefined, otherwise
          renders the given value directly. The dashes vary per seed so each
          path draws with a unique dither rhythm.
        </p>
        <DemoCard code={SNIPPET_SCAN_PROGRESS}>
          <div className="flex h-[200px] items-center justify-center">
            <DitherScanProgress seed={42} width={120} height={40} />
          </div>
        </DemoCard>
        <PropsTable rows={API.scanProgress} />
      </section>
    </>
  );
}
