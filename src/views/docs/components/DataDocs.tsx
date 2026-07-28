"use client";

import { useState } from "react";

import { DitherCalendarGrid, DitherCodeBlock, DitherCompare, DitherDataTable, DitherDiffViewer, DitherGauge, DitherHeatCalendar, DitherJsonTree, DitherMarkdownRender, DitherSpreadsheet, DitherTicker, type DitherCalendarEvent, type DitherHeatValue } from "@dither-kit";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/* Deterministic 13-week sample so SSR and client render the same grid. */
const HEAT_VALUES: DitherHeatValue[] = Array.from({ length: 91 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 0, 1) + i * 86400000);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { date: iso, value: (i * 3 + 1) % 5 };
});

const SNIPPET_DATATABLE = `<DitherDataTable columns={columns} rows={rows} getRowKey={(r) => r.id} color="blue" />
{/* sortable + filterable table · even rows wear a Bayer stripe band · headers
    drive sort state · empty state via placeholder */}`;

const DATATABLE_PROPS: PropRow[] = [
  { prop: "columns", type: "TableColumn<T>[]", default: "required" },
  { prop: "rows", type: "T[]", default: "required" },
  { prop: "getRowKey", type: "(row: T) => string", default: "required" },
  { prop: "sortable / filterable", type: "boolean", default: "per-column" },
  { prop: "sort", type: "SortState — controlled", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const SNIPPET_CODEBLOCK = `<DitherCodeBlock code={src} language="ts" filename="example.ts" />
{/* monospace code with a dithered line-number gutter + copy button · no syntax
    highlighter dep · lines never wrap so gutters stay aligned */}`;

const CODEBLOCK_PROPS: PropRow[] = [
  { prop: "code", type: "string", default: "required" },
  { prop: "language", type: "string — label only", default: "—" },
  { prop: "filename", type: "string — header tab", default: "—" },
  { prop: "showLineNumbers", type: "boolean", default: "true" },
  { prop: "maxHeight", type: "number | string", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const SNIPPET_TICKER = `<DitherTicker items={["DITHER", "CANVAS", "BAYER"]} speed={40} color="blue" />
{/* seamless marquee · dithered diamond separators · requestAnimationFrame loop
    · pauses on hover/focus · left or right direction */}`;

const TICKER_PROPS: PropRow[] = [
  { prop: "items", type: "string[]", default: "—" },
  { prop: "children", type: "ReactNode — raw content", default: "—" },
  { prop: "speed", type: "number — px/s", default: "40" },
  { prop: "direction", type: '"left" | "right"', default: '"left"' },
  { prop: "pauseOnHover", type: "boolean", default: "true" },
  { prop: "gap", type: "number (px)", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const API: Record<string, PropRow[]> = {
  heat: [
    { prop: "values", type: "{ date: yyyy-mm-dd, value: number }[]", default: "required" },
    { prop: "from / to", type: "string — inclusive window", default: "~1yr back / today" },
    { prop: "levels", type: "number — intensity buckets", default: "5" },
    { prop: "color", type: "PixelColor", default: '"green"' },
    { prop: "onSelect", type: "(date: string)", default: "—" },
  ],
  gauge: [
    { prop: "value", type: "number", default: "required" },
    { prop: "min / max", type: "number", default: "0 / 100" },
    { prop: "label / unit", type: "string", default: "— / —" },
    { prop: "color", type: "PixelColor — arc", default: '"green"' },
    { prop: "size / thickness", type: "number (px)", default: "— / —" },
    { prop: "segments", type: "DitherGaugeSegment[] — zone bands", default: "undefined" },
  ],
};

const SNIPPET_HEAT = `<DitherHeatCalendar values={values} color="green" onSelect={setDate} />
{/* GitHub-style contribution grid · each cell a Bayer tile whose density encodes
    the intensity level · defaults to ~1yr back through today */}`;

const SNIPPET_GAUGE = `<DitherGauge value={62} min={0} max={100} label="RPM" unit="%" color="green" />
{/* ordered-dither arc (sparse→dense toward the needle) + crisp needle on a
    second canvas · role="meter" · sweeps on change, jumps under reduced motion */}`;

const SNIPPET_DIFF = `<DitherDiffViewer before={before} after={after} mode="unified" wordLevel color="blue" />
{/* LCS line diff · unchanged runs collapse into a "skip" gap · add/remove lines
    sit on a Bayer tint band (denser = added) · wordLevel highlights the intra-line edit */}`;

const DIFF_PROPS: PropRow[] = [
  { prop: "before / after", type: "string", default: "required" },
  { prop: "mode", type: '"unified" | "split"', default: '"unified"' },
  { prop: "context", type: "number — unchanged lines per change", default: "3" },
  { prop: "wordLevel", type: "boolean — intra-line highlight", default: "false" },
  { prop: "showLineNumbers", type: "boolean", default: "true" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const DIFF_BEFORE = "function dither(seed) {\n  return seed;\n}";
const DIFF_AFTER = "function dither(seed) {\n  return bayer4(seed);\n}";

const SNIPPET_JSONTREE = `<DitherJsonTree data={config} defaultExpandDepth={2} color="blue" />
{/* collapsible JSON inspector · each value wears a Bayer type chip · toolbar
    expands/collapses every container · copyable dot/bracket path per node */}`;

const JSONTREE_PROPS: PropRow[] = [
  { prop: "data", type: "unknown — any JSON value", default: "required" },
  { prop: "defaultExpandDepth", type: "number", default: "1" },
  { prop: "toolbar", type: "boolean — expand/collapse all", default: "true" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const JSON_SAMPLE = {
  name: "dither-ui",
  version: "2.5.0",
  features: ["canvas", "bayer", "charts"],
  engine: { renderer: "canvas", matrix: "bayer4", dither: true },
  counts: { components: 250, charts: 5 },
  tags: ["dark", "monospace", "pixel"],
  active: true,
};

const SNIPPET_COMPARE = `<DitherCompare before={flatPanel} after={ditherPanel} orientation="vertical" />
{/* before/after slider · drag the divider (or arrow keys) to reveal · the seam
    dissolves into a few columns of Bayer stipple, not a hard clip */}`;

const COMPARE_PROPS: PropRow[] = [
  { prop: "before / after", type: "ReactNode", default: "required" },
  { prop: "orientation", type: '"vertical" | "horizontal"', default: '"vertical"' },
  { prop: "position / defaultPosition", type: "number (0–100)", default: "— / 50" },
  { prop: "onPositionChange", type: "(position: number)", default: "—" },
  { prop: "label", type: "string — a11y", default: '"Comparison slider"' },
];

const CALENDAR_EVENTS: DitherCalendarEvent[] = [
  { date: "2024-06-04", label: "Kickoff" },
  { date: "2024-06-11", label: "Sprint review" },
  { date: "2024-06-11", label: "Demo" },
  { date: "2024-06-18", label: "Retro" },
  { date: "2024-06-25", label: "Planning" },
  { date: "2024-06-25", label: "Ship" },
];

const SNIPPET_CALENDARGRID = `<DitherCalendarGrid defaultMonth={month} events={events} color="blue" />
{/* full-month scheduling grid · each day a Bayer tile whose density encodes its
    event count · keyboard-navigable · onSelectDay fires yyyy-mm-dd · controlled
    via month / defaultMonth */}`;

const CALENDARGRID_PROPS: PropRow[] = [
  { prop: "month", type: "Date — controlled view", default: "—" },
  { prop: "defaultMonth", type: "Date — uncontrolled start", default: "—" },
  { prop: "events", type: "DitherCalendarEvent[]", default: "[]" },
  { prop: "selected", type: "Date[]", default: "—" },
  { prop: "weekStartsOn", type: "0 | 1", default: "0" },
  { prop: "cellSize", type: "number (px)", default: "44" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
  { prop: "onMonthChange", type: "(month: Date) => void", default: "—" },
  { prop: "onSelectDay", type: "(iso: string) => void", default: "—" },
];

const SNIPPET_SPREADSHEET = `<DitherSpreadsheet headers={headers} rows={rows} editable color="blue" />
{/* sticky header + first column · selection band is a repeating Bayer tile ·
    =SUM(A1:A3) / =A1+B1 formula engine · arrow-key navigation · optional edit */}`;

const SPREADSHEET_PROPS: PropRow[] = [
  { prop: "rows", type: "DitherSpreadsheetCell[][]", default: "required" },
  { prop: "headers", type: "string[]", default: "A, B, C…" },
  { prop: "editable", type: "boolean", default: "false" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
  { prop: "onCellChange", type: "(row, col, value) => void", default: "—" },
];

const SNIPPET_MARKDOWNRENDER = `<DitherMarkdownRender source={md} />
{/* pure-TS markdown to React · headings get slug ids for DitherOutline · fenced
    blocks compose DitherCodeBlock · override any element via components */}`;

const MARKDOWNRENDER_PROPS: PropRow[] = [
  { prop: "source", type: "string", default: "—" },
  { prop: "children", type: "string — fallback source", default: "—" },
  { prop: "components", type: "MarkdownComponents", default: "{}" },
];

const MARKDOWN_SOURCE = "# Dither\n\nRender **markdown** with the kit texture, not a parser dep.\n\n- ordered point\n- another point\n\n> Blockquote note.\n\nFenced block:\n\n```ts\nfunction dither(seed: number) {\n  return bayer4(seed);\n}\n```";

export function DataDocs() {
  const [heatDate, setHeatDate] = useState<string | null>(null);
  const [gaugeValue, setGaugeValue] = useState(62);

  return (
    <>
      {/* Heat calendar */}
      <section id="heat-calendar" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Heat calendar</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A GitHub-style contribution grid — each day is a full Bayer tile whose
          threshold density encodes the intensity level, so a level-1 cell reads as a
          few sparse pixels and a top-level cell reads near-solid. Defaults to roughly a
          year back through today; click a day to select it.
        </p>
        <DemoCard code={SNIPPET_HEAT}>
          <div className="mx-auto max-w-2xl">
            <DitherHeatCalendar values={HEAT_VALUES} color="green" onSelect={setHeatDate} />
            <p className="mt-3 text-center text-[10px] text-muted-foreground">selected: {heatDate ?? "—"}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.heat} />
      </section>

      {/* Gauge */}
      <section id="gauge" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Gauge</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A radial gauge — the arc is painted with the ordered-dither ramp (filled span
          sparse to dense toward the needle, track a faint scatter, optional zone
          segments recoloured in place) and a crisp needle sits on a second DPR-scaled
          canvas above. The needle sweeps on change and jumps instantly under reduced
          motion; the loop is visibility-gated.
        </p>
        <DemoCard code={SNIPPET_GAUGE}>
          <div className="flex flex-col items-center gap-4">
            <DitherGauge value={gaugeValue} min={0} max={100} label="RPM" unit="%" color="green" size={200} />
            <button
              type="button"
              className="rounded border border-border/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setGaugeValue((v) => (v + 7) % 101)}
            >
              bump
            </button>
          </div>
        </DemoCard>
        <PropsTable rows={API.gauge} />
      </section>
      {/* Data table */}
      <section id="data-table" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Data table</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A sortable, filterable table whose even rows wear a Bayer stripe band so
          the rows read with the kit&apos;s ordered-dither texture instead of a flat
          tint. Columns drive sort state; an empty state renders via placeholder.
          Bring your own columns, rows, and a stable row key.
        </p>
        <DemoCard code={SNIPPET_DATATABLE}>
          <div className="mx-auto max-w-2xl">
            <DitherDataTable
              columns={[
                { key: "name", label: "Name", sortable: true },
                { key: "role", label: "Role", sortable: true },
                { key: "team", label: "Team" },
              ]}
              rows={[
                { id: "1", name: "Ada", role: "Engineer", team: "Atlas" },
                { id: "2", name: "Alan", role: "Designer", team: "Bayer" },
                { id: "3", name: "Grace", role: "Lead", team: "Cosmic" },
                { id: "4", name: "Lin", role: "Engineer", team: "Drift" },
              ]}
              getRowKey={(r) => r.id}
              color="blue"
            />
          </div>
        </DemoCard>
        <PropsTable rows={DATATABLE_PROPS} />
      </section>

      {/* Code block */}
      <section id="code-block" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Code block</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A monospace code display with a dithered line-number gutter, an optional
          filename tab, and a copy button — and no syntax-highlighting dependency.
          The gutter reads with the kit&apos;s ordered-dither texture, and lines never
          wrap so each line number aligns to exactly one source line.
        </p>
        <DemoCard code={SNIPPET_CODEBLOCK}>
          <div className="mx-auto max-w-2xl text-left">
            <DitherCodeBlock
              code={'function dither(seed) {\n  return bayer4(seed);\n}'}
              language="ts"
              filename="example.ts"
              color="blue"
            />
          </div>
        </DemoCard>
        <PropsTable rows={CODEBLOCK_PROPS} />
      </section>

      {/* Ticker */}
      <section id="ticker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Ticker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A seamless marquee — items scroll left or right with dithered diamond
          separators between them, driven by a requestAnimationFrame loop that
          pauses on hover and keyboard focus. Pass item strings, or raw children to
          take full control of the content.
        </p>
        <DemoCard code={SNIPPET_TICKER}>
          <div className="mx-auto max-w-2xl">
            <DitherTicker items={["DITHER", "CANVAS", "BAYER", "PIXELS"]} speed={40} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={TICKER_PROPS} />
      </section>

      {/* Diff viewer */}
      <section id="diff-viewer" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Diff viewer</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A line diff driven by a zero-dependency LCS edit script. Unchanged runs
          collapse into a &ldquo;skip&rdquo; gap you can unfold; added and removed
          lines sit on a Bayer tint band whose density encodes the direction
          (denser = added), and word-level mode highlights the intra-line edit.
          Render unified or split side-by-side.
        </p>
        <DemoCard code={SNIPPET_DIFF}>
          <div className="mx-auto max-w-2xl text-left">
            <DitherDiffViewer before={DIFF_BEFORE} after={DIFF_AFTER} mode="unified" wordLevel color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={DIFF_PROPS} />
      </section>

      {/* JSON tree */}
      <section id="json-tree" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">JSON tree</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A collapsible JSON inspector. Every value wears a Bayer type chip whose
          density encodes its kind (null, boolean, number, string, array, object),
          a toolbar expands and collapses every container, and each node exposes a
          copyable dot/bracket path a developer can paste back into code.
        </p>
        <DemoCard code={SNIPPET_JSONTREE}>
          <div className="mx-auto max-w-2xl text-left">
            <DitherJsonTree data={JSON_SAMPLE} defaultExpandDepth={2} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={JSONTREE_PROPS} />
      </section>

      {/* Compare */}
      <section id="compare" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Compare</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A before/after comparison slider. Drag the divider &mdash; or nudge it
          with the arrow keys &mdash; to reveal the second layer, and the seam
          dissolves into a few columns of Bayer stipple instead of clipping hard.
          Pass any two React nodes; the layers stay perfectly aligned.
        </p>
        <DemoCard code={SNIPPET_COMPARE}>
          <div className="mx-auto max-w-xl">
            <DitherCompare
              orientation="vertical"
              before={
                <div className="grid h-48 place-items-center rounded-lg bg-card text-[11px] font-mono text-muted-foreground">
                  before · flat
                </div>
              }
              after={
                <div
                  className="grid h-48 place-items-center rounded-lg text-[11px] font-mono text-background"
                  style={{ backgroundImage: "repeating-linear-gradient(45deg, #358ff3 0 4px, #1e293b 4px 8px)" }}
                >
                  after · dithered
                </div>
              }
            />
          </div>
        </DemoCard>
        <PropsTable rows={COMPARE_PROPS} />
      </section>

      {/* Calendar grid */}
      <section id="calendar-grid" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Calendar grid</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A full-month scheduling grid. Each day is a Bayer tile whose threshold
          density encodes its event count, so an empty day reads as a faint wash and
          a peak day reads near-solid. Arrow keys walk the week, PageUp/PageDown
          change month, and <code className="text-foreground/80">onSelectDay</code>{" "}
          fires the activated day as <code className="text-foreground/80">yyyy-mm-dd</code>;
          pass <code className="text-foreground/80">month</code> to control the view
          or <code className="text-foreground/80">defaultMonth</code> for an
          uncontrolled start.
        </p>
        <DemoCard code={SNIPPET_CALENDARGRID}>
          <div className="mx-auto max-w-2xl">
            <DitherCalendarGrid defaultMonth={new Date(Date.UTC(2024, 5, 1))} events={CALENDAR_EVENTS} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={CALENDARGRID_PROPS} />
      </section>

      {/* Spreadsheet */}
      <section id="spreadsheet" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Spreadsheet</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A sticky-header, sticky-first-column cell grid. The selection band is a
          repeating Bayer tile so a range reads as one contiguous dithered strip, a
          zero-dependency formula engine resolves{" "}
          <code className="text-foreground/80">=SUM(A1:A3)</code> and{" "}
          <code className="text-foreground/80">=A1+B1</code>, and arrow keys roam the
          cells. Set <code className="text-foreground/80">editable</code> to type into
          cells.
        </p>
        <DemoCard code={SNIPPET_SPREADSHEET}>
          <div className="mx-auto max-w-2xl text-left">
            <DitherSpreadsheet
              headers={["Region", "Q1", "Q2", "Q3", "Q4"]}
              rows={[
                ["North", "120", "150", "130", "160"],
                ["South", "80", "90", "85", "95"],
                ["East", "60", "70", "75", "80"],
                ["West", "110", "125", "140", "150"],
              ]}
              color="blue"
            />
          </div>
        </DemoCard>
        <PropsTable rows={SPREADSHEET_PROPS} />
      </section>

      {/* Markdown render */}
      <section id="markdown-render" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Markdown render</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A pure-TypeScript markdown-to-React renderer with no parser dependency.
          Headings get stable slug ids so they integrate with{" "}
          <code className="text-foreground/80">DitherOutline</code>, fenced code
          blocks compose <code className="text-foreground/80">DitherCodeBlock</code>{" "}
          (inheriting the dithered line-number gutter), and a{" "}
          <code className="text-foreground/80">components</code> prop overrides any
          element type.
        </p>
        <DemoCard code={SNIPPET_MARKDOWNRENDER}>
          <div className="mx-auto max-w-2xl text-left">
            <DitherMarkdownRender source={MARKDOWN_SOURCE} />
          </div>
        </DemoCard>
        <PropsTable rows={MARKDOWNRENDER_PROPS} />
      </section>

    </>
  );
}
