"use client";

import { useEffect, useRef, useState } from "react";

import {
  DitherBadge,
  DitherButton,
  DitherCanvas,
  DitherConsole,
  DitherInfiniteCanvas,
  DitherRail,
  DitherShell,
  DitherSidebarItem,
  DitherTerminalPrompt,
  DitherTooltip,
  type ConsoleLine,
} from "@dither-kit";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/* Console demo: a fake deploy streams lines in. */
const SEED_LINES: ConsoleLine[] = [
  { text: "$ deploy --prod", at: "12:01" },
  { text: "building 34 routes…", at: "12:01" },
  { text: "build ok (4.2s)", at: "12:01", level: "success" },
];
const DEPLOY_STEPS: ConsoleLine[] = [
  { text: "$ deploy --prod" },
  { text: "linting… 0 problems" },
  { text: "bundling client…" },
  { text: "warn: chunk over 300kB", level: "warn" },
  { text: "uploading assets…" },
  { text: "deployed to dither-ui.com", level: "success" },
];

const SNIPPET_TERMINAL = `<DitherTerminalPrompt
  history={history}
  prompt="$"
  title="terminal"
  color="green"
  completions={['deploy', 'build', 'test']}
  onSubmit={(line) => setHistory((h) => [...h, line])}
/>
{/* the interactive twin of DitherConsole — type, Enter commits, ↑↓ recalls,
    Tab accepts the ghost completion; you own the scrollback */}`;

const API: Record<string, PropRow[]> = {
  shell: [
    { prop: "frame", type: "boolean — embedded card chrome (border, rounding, clip)", default: "false" },
    { prop: "topbar · aside · statusbar", type: "ReactNode — regions render only when filled", default: "—" },
    { prop: "children", type: "content (the main surface)", default: "—" },
  ],
  rail: [
    { prop: "label", type: "string — aria-label for the nav landmark", default: '"Rail"' },
    { prop: "side", type: '"left" | "right" — flips the border edge', default: '"left"' },
    { prop: "header · footer", type: "ReactNode — above / below the nav", default: "—" },
    { prop: "children", type: "items — labels fold automatically", default: "—" },
  ],
  console: [
    { prop: "lines", type: "(string | { text, level?, at? })[] — level: info | success | warn | error", default: "[]" },
    { prop: "title", type: "string — header caption", default: '"console"' },
    { prop: "follow", type: "boolean — pin the view to the newest line", default: "true" },
    { prop: "caret", type: "boolean — blinking block caret (still under reduced motion)", default: "true" },
    { prop: "actions", type: "ReactNode — right side of the header", default: "—" },
  ],
  canvas: [
    { prop: "pattern", type: '"dots" | "grid" | "plain"', default: '"dots"' },
    { prop: "cell", type: "number — pattern pitch in px", default: "16" },
    { prop: "children", type: "content (the work surface)", default: "—" },
  ],
  infinite: [
    { prop: "zoom", type: "number (value / onZoomChange)", default: "1" },
    { prop: "minZoom / maxZoom", type: "number — clamp range", default: "0.25 / 3" },
    { prop: "pattern", type: '"dots" | "grid" | "plain"', default: '"dots"' },
    { prop: "cell", type: "number — pattern pitch at zoom 1, px", default: "16" },
    { prop: "children", type: "absolutely-positioned artboards", default: "—" },
  ],
  terminal: [
    { prop: "history", type: "(string | { text, level?, at? })[] — consumer owns it", default: "[]" },
    { prop: "prompt", type: "string — glyph before the input", default: '"$"' },
    { prop: "title", type: "string — header caption", default: '"terminal"' },
    { prop: "completions", type: "string[] — inline ghost-text", default: "undefined" },
    { prop: "color", type: "PixelColor — prompt + echo accent", default: '"green"' },
    { prop: "onSubmit", type: "(line: string) — append to history", default: "—" },
  ],
};

const SNIPPET_SHELL = `<DitherShell frame className="h-96"
  topbar={<>…brand · search · avatar…</>}
  aside={
    <DitherRail label="Primary">          {/* items fold to icons */}
      {items.map((i) => (
        <DitherTooltip key={i} text={i}>
          <DitherSidebarItem label={i} active={active === i} onSelect={() => setActive(i)} />
        </DitherTooltip>
      ))}
    </DitherRail>
  }
  statusbar={<>…env · status…</>}
>
  <DitherCanvas pattern="dots" className="h-full p-4">
    {/* stat cards, artboards, anything */}
    <DitherConsole lines={log} className="mt-3 h-40" />
  </DitherCanvas>
</DitherShell>`;

const SNIPPET_RAIL = `<DitherRail label="Primary"
  header={<>…glyph…</>}
  footer={<DitherAvatar name="Ada Byte" size={22} />}
>
  {items.map((i) => (          {/* labels ride tooltips */}
    <DitherTooltip key={i.label} text={i.label}>
      <DitherSidebarItem label={i.label} badge={i.badge} color={i.color}
        active={active === i.label} onSelect={() => setActive(i.label)} />
    </DitherTooltip>
  ))}
</DitherRail>

{/* provides the sidebar's collapsed context —
    DitherSidebarItem folds its label with zero extra props */}`;

const SNIPPET_CONSOLE = `<DitherConsole lines={lines} title="deploy" className="h-48"
  actions={
    <DitherButton color="green" disabled={deploying} onClick={deploy}>Run</DitherButton>
  }
/>

{/* lines: strings or { text, level, at } —
    level tints via the palette: success · warn · error.
    follow keeps the newest line in view; caret blinks (reduced motion: still) */}`;

const SNIPPET_CANVAS = `<DitherCanvas pattern={pattern} cell={16} className="h-64 p-6">
  …artboards, cards, anything…
</DitherCanvas>

{/* pattern: dots | grid | plain — inked with var(--border), content above */}`;

const SNIPPET_INFINITE = `<DitherInfiniteCanvas zoom={zoom} onZoomChange={setZoom} className="h-72 rounded-lg border">
  <div className="absolute" style={{ left: 40, top: 40 }}>…an artboard…</div>
  <div className="absolute" style={{ left: 320, top: 160 }}>…another…</div>
</DitherInfiniteCanvas>

{/* drag pans · wheel zooms toward the cursor · the dot field
    rides the same transform, so space feels real */}`;

export function LayoutDocs() {
  const [termHistory, setTermHistory] = useState<(string | ConsoleLine)[]>([
    "$ run boot",
    "dither engine ready",
    "channels online",
  ]);
  const [shellActive, setShellActive] = useState("Overview");
  const railItems = ["Overview", "Deploys", "Data", "Alerts"];

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>(SEED_LINES);
  const [deploying, setDeploying] = useState(false);
  const timers = useRef<number[]>([]);
  function deploy() {
    if (deploying) return;
    setDeploying(true);
    const at = () => new Date().toTimeString().slice(0, 5);
    DEPLOY_STEPS.forEach((s, i) =>
      timers.current.push(
        window.setTimeout(() => {
          setConsoleLines((prev) => [...prev, { ...s, at: at() }]);
          if (i === DEPLOY_STEPS.length - 1) setDeploying(false);
        }, 450 * (i + 1)),
      ),
    );
  }
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const [canvasPattern, setCanvasPattern] = useState<"dots" | "grid" | "plain">("dots");
  const [canvasZoom, setCanvasZoom] = useState(1);

  const shellAside = (
    <DitherRail label="Primary">
      {railItems.map((i) => (
        <DitherTooltip key={i} text={i}>
          <DitherSidebarItem label={i} active={shellActive === i} onSelect={() => setShellActive(i)} />
        </DitherTooltip>
      ))}
    </DitherRail>
  );

  return (
    <>
      {/* Shell */}
      <section id="dither-shell" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Shell</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The app frame — a topbar over an aside + content pair, with an optional
          statusbar underneath. Regions render only when their prop is filled, so the
          grid adapts; nest a Rail, a Canvas and a Console for a full studio surface.
        </p>
        <DemoCard code={SNIPPET_SHELL}>
          <DitherShell
            frame
            className="mx-auto h-[26rem] max-w-2xl"
            topbar={
              <div className="flex h-10 w-full items-center gap-2 px-3">
                <span className="inline-block size-2.5 rounded-[2px] bg-foreground" />
                <span className="text-[11px] text-muted-foreground">dither-ui · studio</span>
                <span className="ml-auto inline-block size-2.5 rounded-[2px] bg-foreground" />
              </div>
            }
            aside={shellAside}
            statusbar={
              <div className="flex h-8 w-full items-center gap-2 px-3 text-[10px] text-muted-foreground">
                <span>main</span>
                <span className="ml-auto">ready</span>
              </div>
            }
          >
            <DitherCanvas pattern="dots" className="h-full p-3">
              <div className="grid grid-cols-3 gap-2">
                {[["Requests", "84k"], ["Errors", "0.2%"], ["P95", "212ms"]].map(([l, v]) => (
                  <div key={l} className="rounded-md border border-border/60 bg-background/70 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">{l}</span>
                      <span className="font-mono text-[12px] text-foreground">{v}</span>
                    </div>
                  </div>
                ))}
              </div>
              <DitherConsole
                lines={consoleLines}
                title="deploys"
                caret={false}
                className="mt-3 h-36"
                actions={<DitherBadge color="green" className="text-[9px]">live</DitherBadge>}
              />
            </DitherCanvas>
          </DitherShell>
        </DemoCard>
        <PropsTable rows={API.shell} />
      </section>

      {/* Rail */}
      <section id="rail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Rail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A collapsed navigation rail — it provides the sidebar context so nested
          DitherSidebarItems fold their labels down to icons. Header and footer props
          bracket the items; the border flips with the side.
        </p>
        <DemoCard code={SNIPPET_RAIL}>
          <div className="mx-auto flex h-72 max-w-sm overflow-hidden rounded-lg border border-border/60">
            <DitherRail
              label="Demo rail"
              header={
                <div className="grid h-8 place-items-center">
                  <span className="inline-block size-2.5 rounded-[2px] bg-foreground" />
                </div>
              }
              footer={
                <div className="grid h-8 place-items-center">
                  <span className="inline-block size-2.5 rounded-[2px] bg-foreground" />
                </div>
              }
            >
              {railItems.map((i) => (
                <DitherTooltip key={i} text={i}>
                  <DitherSidebarItem label={i} active={shellActive === i} onSelect={() => setShellActive(i)} />
                </DitherTooltip>
              ))}
            </DitherRail>
            <div className="grid flex-1 place-items-center text-[12px] text-muted-foreground">content</div>
          </div>
        </DemoCard>
        <PropsTable rows={API.rail} />
      </section>

      {/* Console */}
      <section id="console" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Console</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A terminal panel — lines are strings or objects with a level and timestamp,
          follow pins the newest line in view, and a blinking caret marks the prompt.
          Wire the actions prop to a Run button that streams output.
        </p>
        <DemoCard code={SNIPPET_CONSOLE}>
          <div className="mx-auto max-w-lg">
            <DitherConsole
              lines={consoleLines}
              title="deploy"
              className="h-52"
              actions={
                <DitherButton
                  color="green"
                  className="px-2 py-0.5 text-[10px]"
                  disabled={deploying}
                  onClick={deploy}
                >
                  Run
                </DitherButton>
              }
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.console} />
      </section>

      {/* Canvas */}
      <section id="canvas" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Canvas</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The work surface — a dithered dot, grid or plain field that content floats
          above. The pattern is inked with the border color so it reads as structure,
          not decoration.
        </p>
        <DemoCard code={SNIPPET_CANVAS}>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {(["dots", "grid", "plain"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={canvasPattern === p}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                    canvasPattern === p ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setCanvasPattern(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <DitherCanvas pattern={canvasPattern} className="mt-3 h-56 w-full rounded-lg border border-border/60 p-5">
              <div className="w-40 rounded-md border border-border/60 bg-background/80 p-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Artboard</div>
                <div className="mt-1 text-[12px] text-foreground">Floats above the field</div>
              </div>
            </DitherCanvas>
          </div>
        </DemoCard>
        <PropsTable rows={API.canvas} />
      </section>

      {/* Infinite canvas */}
      <section id="infinite-canvas" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Infinite canvas</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A pannable, zoomable surface — drag to pan, wheel to zoom toward the cursor.
          The dot field rides the same transform as the artboards, so the space feels
          real and continuous.
        </p>
        <DemoCard code={SNIPPET_INFINITE}>
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] text-muted-foreground">zoom: {canvasZoom.toFixed(2)}×</p>
            <DitherInfiniteCanvas
              zoom={canvasZoom}
              onZoomChange={setCanvasZoom}
              className="mt-2 h-64 w-full rounded-lg border border-border/60"
            >
              <div className="absolute w-40 rounded-md border border-border/60 bg-background/80 p-3" style={{ left: 32, top: 32 }}>
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Artboard A</div>
                <div className="mt-1 text-[12px] text-foreground">Drag the field</div>
              </div>
              <div className="absolute w-40 rounded-md border border-border/60 bg-background/80 p-3" style={{ left: 260, top: 140 }}>
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Artboard B</div>
                <div className="mt-1 text-[12px] text-foreground">Wheel to zoom</div>
              </div>
            </DitherInfiniteCanvas>
          </div>
        </DemoCard>
        <PropsTable rows={API.infinite} />
      </section>
      <section id="terminal-prompt" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Terminal prompt</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The interactive counterpart to the read-only Console — a monospace prompt
          line over a real input, with command history (↑↓), inline ghost-text
          completion (Tab / ArrowRight), and a blinking block caret. History is
          controlled: append on onSubmit and the scrollback stays the source of truth.
        </p>
        <DemoCard code={SNIPPET_TERMINAL}>
          <div className="mx-auto max-w-lg">
            <DitherTerminalPrompt
              history={termHistory}
              prompt="$"
              title="terminal"
              color="green"
              completions={["deploy", "build", "test", "lint"]}
              onSubmit={(line) => setTermHistory((h) => [...h, line])}
            />
  </div>
        </DemoCard>
        <PropsTable rows={API.terminal} />
      </section>

    </>
  );
}
