"use client";

import { useState } from "react";

import {
  DitherCheckbox,
  DitherColorPalette,
  DitherColorPicker,
  DitherFilterChip,
  DitherProgress,
  DitherQueryBuilder,
  DitherSlider,
  DitherSlider2D,
  DitherSwitch,
  DitherTagInput,
  type DitherFilterOption,
  type DitherQueryField,
  type DitherQueryRule,
  type DitherSlider2DValue,
  type DitherSwatch,
  type SliderVariant,
  DitherDatePicker,
  DitherDropzone,
  DitherImageCropper,
  DitherMentionInput,
  DitherRangeSlider,
  DitherSegmented,
  DitherShortcutRecorder,
  DitherSignaturePad,
  DitherTimePicker,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/**
 * FormDocs — Switch / Checkbox / Slider / Progress section pack.
 * Port of `src/pages/docs/components/FormDocs.vue`.
 *
 * One React component rendering a fragment of sections, matching the Vue
 * `<template>` (which is itself a fragment). Section ids, classes, prose,
 * SNIPPET_* code strings, and the API table rows are ported verbatim from
 * the Vue source. The SNIPPET_* strings show React/TSX usage of the kit,
 * documenting the API the demo renders.
 *
 * State mapping (guide §4): `ref(true)` → `useState(true)`,
 * `reactive({...})` → one `useState` object updated via a setter that spreads
 * the previous value, `v-model` → `value` + `onChange`. The progress bar
 * below binds to the same `level` state as the slider above it (Vue contract).
 */
const SLIDER_VARIANTS = ["gradient", "dotted", "hatched", "solid"] as const;

const SNIPPET_SWITCH = `import { DitherSwitch } from "@dither-kit"
import { useState } from "react"

const [bloom, setBloom] = useState(true)

<label className="flex items-center justify-between gap-4">
  <span className="text-[13px]">Bloom on hover</span>
  <DitherSwitch value={bloom} onChange={setBloom} label="Bloom on hover" color="blue" />
</label>`;

const SNIPPET_CHECKBOX = `import { DitherCheckbox } from "@dither-kit"
import { useState } from "react"

const [opts, setOpts] = useState({ grid: true, snap: false, rulers: true })

<div className="grid gap-3">
  <DitherCheckbox value={opts.grid} onChange={v => setOpts(o => ({ ...o, grid: v }))}>Show grid</DitherCheckbox>
  <DitherCheckbox value={opts.snap} onChange={v => setOpts(o => ({ ...o, snap: v }))}>Snap to pixels</DitherCheckbox>
  <DitherCheckbox value={opts.rulers} onChange={v => setOpts(o => ({ ...o, rulers: v }))}>Show rulers</DitherCheckbox>
</div>`;

const SNIPPET_SLIDER = `import { useState } from "react"

const [level, setLevel] = useState(40)
const [range, setRange] = useState<[number, number]>([25, 75])

{/* single */}
<DitherSlider value={level} onChange={setLevel} label="Level" />

{/* range: an array value grows a second thumb */}
<DitherSlider value={range} onChange={setRange} label="Price" show-value />

{/* ticks mark the steps; variant picks the fill texture */}
<DitherSlider value={quality} onChange={setQuality} label="Quality" step={10} ticks
  variant="dotted" show-value />`;

const SNIPPET_PROGRESS = `import { DitherProgress } from "@dither-kit"
import { useState } from "react"

const [level, setLevel] = useState(40)

<div className="grid gap-6">
  <DitherProgress value={level} color="blue" />
  <DitherProgress indeterminate color="purple" />
</div>`;

const SNIPPET_COLOR = `<DitherColorPicker value={tint} onChange={setTint} />`;

const SNIPPET_TAG = `<DitherTagInput value={tags} onChange={setTags} max={8} placeholder="Add tag…" />`;

const SNIPPET_DATEPICKER = `<DitherDatePicker value={due} onChange={setDue} min="2026-01-01" />`;

const DATEPICKER_PROPS: PropRow[] = [
  { prop: "value / onChange", type: "string (ISO YYYY-MM-DD)", default: '""' },
  { prop: "min / max", type: "string (ISO)", default: "" },
  { prop: "onSelect", type: "(iso) when picked", default: "" },
];

const SNIPPET_RANGESLIDER = `<DitherRangeSlider value={range} onChange={setRange} min={0} max={100} showValues color="blue" />
{/* dual-thumb min/max selector · selected span is a dense Bayer ramp, rails a
    sparse wash · thumbs never cross · Arrows nudge, Shift+Arrows ×10 */}`;

const RANGESLIDER_PROPS: PropRow[] = [
  { prop: "value", type: "[number, number]", default: "required" },
  { prop: "onChange", type: "(value: [number, number])", default: "—" },
  { prop: "min / max", type: "number", default: "0 / 100" },
  { prop: "step", type: "number", default: "1" },
  { prop: "showValues", type: "boolean", default: "false" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const SNIPPET_SEGMENTED = `<DitherSegmented segments={["Day", "Week", "Month"]} value={view} onChange={setView} color="blue" />
{/* iOS-style segmented control · active segment marked by a sliding dithered
    indicator · radiogroup + roving tabindex · Arrows walk, Home/End jump */}`;

const SEGMENTED_PROPS: PropRow[] = [
  { prop: "segments", type: "(string | SegmentItem)[]", default: "required" },
  { prop: "value", type: "string", default: "—" },
  { prop: "onChange", type: "(value: string)", default: "—" },
  { prop: "label", type: "string", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const SNIPPET_TIMEPICKER = `<DitherTimePicker value={time} onChange={setTime} color="blue" />
{/* hour/minute columns · hour12 adds an AM/PM segmented toggle · minuteStep
    snaps granularity · value is "HH:MM" or minutes-since-midnight */}`;

const TIMEPICKER_PROPS: PropRow[] = [
  { prop: "value", type: '"HH:MM" | number (0–1439)', default: "—" },
  { prop: "onChange", type: "(value: TimeValue)", default: "—" },
  { prop: "hour12", type: "boolean", default: "false" },
  { prop: "minuteStep", type: "number", default: "1" },
  { prop: "rows", type: "number — visible per column", default: "7" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const SNIPPET_SIGNATUREPAD = `<DitherSignaturePad onChange={save} height={180} />`;

const SIGNATUREPAD_PROPS: PropRow[] = [
  { prop: "width / height", type: "number (canvas)", default: "420 / 160" },
  { prop: "onChange", type: '(dataURL) per stroke, "" on clear', default: "" },
];

const SNIPPET_DROPZONE = `<DitherDropzone accept="image/*" label="Drop files here" hint="or click to browse" color="blue" />
{/* drag-over state intensifies as an ordered-dither wash · files filtered by
    accept + maxSize · accepted fire onFiles, rejected fire onReject */}`;

const DROPZONE_PROPS: PropRow[] = [
  { prop: "accept", type: "string — MIME/ext list", default: "—" },
  { prop: "multiple", type: "boolean", default: "false" },
  { prop: "maxSize", type: "number — bytes", default: "—" },
  { prop: "onFiles", type: "(files: File[])", default: "—" },
  { prop: "onReject", type: "(rejected: { file, reason }[])", default: "—" },
  { prop: "label / hint", type: "ReactNode", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const API: Record<string, PropRow[]> = {
  switch: [
    { prop: "modelValue", type: "boolean", default: "—" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "className", type: "string", default: "—" },
  ],
  checkbox: [
    { prop: "modelValue", type: "boolean", default: "—" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "className", type: "string", default: "—" },
  ],
  slider: [
    { prop: "modelValue", type: "number | [number, number] — array = range", default: "—" },
    { prop: "min / max / step", type: "number", default: "0 / 100 / 1" },
    { prop: "variant", type: '"gradient" | "dotted" | "hatched" | "solid"', default: '"gradient"' },
    { prop: "ticks", type: "boolean — tick columns at steps (≤25) or tenths", default: "false" },
    { prop: "show-value", type: "boolean — bubble while dragging or focused", default: "false" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  progress: [
    { prop: "value", type: "number", default: "0" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "indeterminate", type: "boolean", default: "false" },
    { prop: "className", type: "string", default: "—" },
  ],
  colorPicker: [
    { prop: "value / onChange", type: "string (hex)", default: '"#5227FF"' },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  tagInput: [
    { prop: "value / onChange", type: "string[]", default: "[]" },
    { prop: "max", type: "number", default: "Infinity" },
  ],
};

const SNIPPET_IMAGECROPPER = `<DitherImageCropper src={url} aspect={16 / 9} onChange={setRect} />
{/* 8-handle crop box · pan + wheel zoom · aspect lock · imperative ref exposes
    toDataURL() at native resolution */}`;

const IMAGECROPPER_PROPS: PropRow[] = [
  { prop: "src", type: "string — image URL", default: "required" },
  { prop: "aspect", type: "number — width/height lock (0 = free)", default: "0" },
  { prop: "rect / defaultRect", type: "CropRect — { x, y, width, height } (0–1)", default: "centred 80%" },
  { prop: "onChange", type: "(rect: CropRect) => void", default: "—" },
  { prop: "minSize", type: "number — min crop fraction per side", default: "0.05" },
  { prop: "ref", type: "DitherImageCropperHandle — toDataURL()", default: "—" },
];

const CROPPER_SRC =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22240%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23358ff3%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23f05abe%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22320%22%20height%3D%22240%22%20fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E";

const SNIPPET_MENTION = `<DitherMentionInput value={body} onChange={setBody} options={handles} onMention={notify} />`;

const MENTION_PROPS: PropRow[] = [
  { prop: "value / onChange", type: "string", default: '""' },
  { prop: "options", type: "string[]", default: "[]" },
  { prop: "onMention", type: "(handle) on insert", default: "" },
];

const MENTION_HANDLES = ["dana", "darius", "daniela", "sam"];

const SNIPPET_SHORTCUT = `<DitherShortcutRecorder value={chord} onChange={setChord} conflicts={taken} />
{/* click to arm, press a real key to capture · canonical chord like Mod+Shift+K
    · Mod is the platform-primary modifier · matching a conflict shows a badge */}`;

const SHORTCUT_PROPS: PropRow[] = [
  { prop: "value / defaultChord", type: "string — e.g. Mod+Shift+K", default: "—" },
  { prop: "onChange", type: "(chord: string) => void", default: "—" },
  { prop: "conflicts", type: "string[] — taken bindings", default: "[]" },
  { prop: "onConflictChange", type: "(conflicted: boolean) => void", default: "—" },
  { prop: "placeholder / label", type: "string", default: "—" },
];

const QUERY_FIELDS: DitherQueryField[] = [
  { key: "name", label: "Name", type: "string" },
  { key: "age", label: "Age", type: "number" },
  { key: "active", label: "Active", type: "boolean" },
  { key: "created", label: "Created", type: "date" },
];

const SNIPPET_QUERYBUILDER = `<DitherQueryBuilder fields={fields} value={rules} combinator="and" onChange={setRules} color="blue" />
{/* type-aware rule rows · operators adapt to the field type · AND/OR combinator ·
    flat Rule[] you own · a string field with options renders a select */}`;

const QUERYBUILDER_PROPS: PropRow[] = [
  { prop: "fields", type: "DitherQueryField[]", default: "required" },
  { prop: "value", type: "DitherQueryRule[]", default: "required" },
  { prop: "onChange", type: "(rules: DitherQueryRule[]) => void", default: "required" },
  { prop: "combinator", type: '"and" | "or"', default: '"and"' },
  { prop: "onCombinatorChange", type: "(c: DitherQueryCombinator) => void", default: "—" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const PALETTE_SWATCHES: DitherSwatch[] = [
  { name: "Ink", hex: "#0A0A12" },
  { name: "Plasma", hex: "#5227FF" },
  { name: "Aurora", hex: "#7CFF67" },
  { name: "Ember", hex: "#FF3D2E" },
  { name: "Gold", hex: "#FFD23D" },
  { name: "Sky", hex: "#7CE0FF" },
];

const SNIPPET_COLORPALETTE = `<DitherColorPalette swatches={swatches} value={hex} onChange={setHex} />
{/* every tile runs through the Bayer engine · search by name or hex · copy on
    click · custom-hex add · 2D grid keyboard nav with roving tabindex */}`;

const COLORPALETTE_PROPS: PropRow[] = [
  { prop: "swatches", type: "DitherSwatch[]", default: "required" },
  { prop: "value", type: "string — #rrggbb", default: "—" },
  { prop: "onChange", type: "(hex: string) => void", default: "—" },
  { prop: "onAddCustom", type: "(hex: string) => void", default: "—" },
  { prop: "label", type: "string", default: "—" },
];

const FILTER_OPTIONS: DitherFilterOption[] = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "svelte", label: "Svelte" },
  { value: "solid", label: "Solid" },
  { value: "angular", label: "Angular" },
];

const SNIPPET_FILTERCHIP = `<DitherFilterChip label="Framework" options={options} value={picked} onChange={setPicked} />
{/* discrete filter chip · popover of checkboxes · border ramp denser per selection ·
    draft-then-commit (Apply/Clear) · count badge */}`;

const FILTERCHIP_PROPS: PropRow[] = [
  { prop: "label", type: "string", default: "required" },
  { prop: "options", type: "DitherFilterOption[]", default: "required" },
  { prop: "value", type: "string[]", default: "—" },
  { prop: "onChange", type: "(values: string[]) => void", default: "—" },
];

const SNIPPET_SLIDER2D = `<DitherSlider2D value={pos} onChange={setPos} color="blue" />
{/* 2D XY pad · the origin-to-value quadrant is a dense Bayer map, the rest faint ·
    drag or arrows (Shift = 10%) · aria-valuetext conveys x/y */}`;

const SLIDER2D_PROPS: PropRow[] = [
  { prop: "value", type: "DitherSlider2DValue — { x, y } in [0,1]", default: "required" },
  { prop: "onChange", type: "(v: DitherSlider2DValue) => void", default: "—" },
  { prop: "width / height", type: "number | string", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
  { prop: "disabled", type: "boolean", default: "false" },
];

export function FormDocs() {
  const [date, setDate] = useState("2026-10-07");
  const [range, setRange] = useState<[number, number]>([20, 80]);
  const [view, setView] = useState("Day");
  const [time, setTime] = useState("09:30");
  const [accent, setAccent] = useState("#5227FF");
  const [tags, setTags] = useState(["vue", "dither"]);
  const [mention, setMention] = useState("cc @da");
  const [bloom, setBloom] = useState(true);

  const [opts, setOpts] = useState({ grid: true, snap: false, rulers: true });

  const [level, setLevel] = useState(40);
  const [priceRange, setPriceRange] = useState<[number, number]>([25, 75]);
  const [quality, setQuality] = useState(60);
  const [variantLevels, setVariantLevels] = useState<Record<SliderVariant, number>>({
    gradient: 65,
    dotted: 65,
    hatched: 65,
    solid: 65,
  });
  const [queryRules, setQueryRules] = useState<DitherQueryRule[]>([{ field: "name", op: "contains", value: "dither" }]);
  const [paletteHex, setPaletteHex] = useState("#5227FF");
  const [filterPicked, setFilterPicked] = useState<string[]>(["vue", "react"]);
  const [sliderPos, setSliderPos] = useState<DitherSlider2DValue>({ x: 0.4, y: 0.7 });

  return (
    <>
      <section id="switch" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Switch</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A toggle whose track is a dithered canvas — the accent gradient fills in
          when on, fades to a muted wash when off.
        </p>
        <DemoCard code={SNIPPET_SWITCH}>
          <div className="mx-auto max-w-sm">
            <label className="flex items-center justify-between gap-4">
              <span className="text-[13px]">Bloom on hover</span>
              <DitherSwitch value={bloom} onChange={setBloom} label="Bloom on hover" color="blue" />
            </label>
          </div>
        </DemoCard>
        <PropsTable rows={API.switch} />
      </section>

      <section id="checkbox" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Checkbox</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A pixel-border box that fills with the Bayer texture and draws a chunky
          near-white checkmark when checked. Label goes in the default slot.
        </p>
        <DemoCard code={SNIPPET_CHECKBOX}>
          <div className="mx-auto grid max-w-sm gap-3">
            <DitherCheckbox value={opts.grid} onChange={(v) => setOpts((prev) => ({ ...prev, grid: v }))}>
              Show grid
            </DitherCheckbox>
            <DitherCheckbox value={opts.snap} onChange={(v) => setOpts((prev) => ({ ...prev, snap: v }))}>
              Snap to pixels
            </DitherCheckbox>
            <DitherCheckbox value={opts.rulers} onChange={(v) => setOpts((prev) => ({ ...prev, rulers: v }))}>
              Show rulers
            </DitherCheckbox>
          </div>
        </DemoCard>
        <PropsTable rows={API.checkbox} />
      </section>

      <section id="slider" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Slider</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Drag or arrow-key the square thumb — the filled side of the track dithers
          denser toward the value, the rest stays a muted rail.
        </p>
        <DemoCard code={SNIPPET_SLIDER}>
          <div className="mx-auto grid max-w-sm gap-7">
            <div className="flex items-center gap-4">
              <DitherSlider value={level} onChange={(v) => setLevel(Array.isArray(v) ? v[1] : v)} label="Level" min={0} max={100} step={1} color="blue" />
              <span className="w-8 text-right text-[13px] tabular-nums">{level}</span>
            </div>
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Price range</span>
                <span className="tabular-nums">{priceRange[0]} – {priceRange[1]}</span>
              </div>
              <DitherSlider value={priceRange} onChange={(v) => setPriceRange(Array.isArray(v) ? v : [priceRange[0], priceRange[1]])} label="Price" color="green" showValue />
            </div>
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Quality · step 10 · ticks</span>
                <span className="tabular-nums">{quality}</span>
              </div>
              <DitherSlider value={quality} onChange={(v) => setQuality(Array.isArray(v) ? v[1] : v)} label="Quality" step={10} ticks showValue color="purple" />
            </div>
          </div>
        </DemoCard>
        <h3 className="mt-8 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">variants</h3>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {SLIDER_VARIANTS.map((v) => (
            <div key={v}>
              <DitherSlider
                value={variantLevels[v]}
                onChange={(next) => setVariantLevels((prev) => ({ ...prev, [v]: Array.isArray(next) ? next[1] : next }))}
                label={`${v} slider`}
                variant={v}
              />
              <div className="mt-2 text-center text-[10px] text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>
        <PropsTable rows={API.slider} />
      </section>

      <section id="progress" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Progress</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A dithered fill that grows with <code className="text-foreground/80">value</code>;
          set <code className="text-foreground/80">indeterminate</code> to scroll a
          texture band instead (static under reduced motion). The bar below is bound
          to the slider above.
        </p>
        <DemoCard code={SNIPPET_PROGRESS}>
          <div className="mx-auto grid max-w-sm gap-6">
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>Rendering</span>
                <span className="tabular-nums">{level}%</span>
              </div>
              {/* Bound to the same `level` state as the slider above (Vue contract). */}
              <DitherProgress value={level} color="blue" />
            </div>
            <div className="grid gap-2">
              <span className="text-[11px] text-muted-foreground">Indexing</span>
              <DitherProgress indeterminate color="purple" />
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.progress} />
      </section>
      <section id="color-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Color picker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          HSV field + hue strip + hex readout: the plane is pointer-driven (arrows nudge S/V, Shift for coarse), the hue
          strip is a slider of its own, and the hex input accepts what you type. Model = hex string.
        </p>
        <DemoCard code={SNIPPET_COLOR}>
          <div className="flex justify-center">
            <DitherColorPicker value={accent} onChange={setAccent} />
          </div>
        </DemoCard>
        <PropsTable rows={API.colorPicker} />
      </section>

      <section id="tag-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tag input</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Tags as chips in one field: Enter or comma commits, Backspace on an empty input pulls the last chip back in,
          per-chip × removes. Trimmed, case-deduped, <code className="text-foreground/80">max</code>-capped.
        </p>
        <DemoCard code={SNIPPET_TAG}>
          <div className="mx-auto w-full max-w-sm">
            <DitherTagInput value={tags} onChange={setTags} placeholder="Add tag…" />
          </div>
        </DemoCard>
        <PropsTable rows={API.tagInput} />
      </section>

      {/* Date picker */}
      <section id="date-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Date picker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Date field + calendar popover: the input shows a human format, the calendar opens on click/focus, select closes,
          Escape and outside-click dismiss. The model stays ISO.
        </p>
        <DemoCard code={SNIPPET_DATEPICKER}>
          <div className="mx-auto w-full max-w-xs">
            <DitherDatePicker value={date} onChange={setDate} />
          </div>
        </DemoCard>
        <PropsTable rows={DATEPICKER_PROPS} />
      </section>

      {/* Range slider */}
      <section id="range-slider" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Range slider</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A dual-thumb minimum/maximum selector on a dithered track. The selected
          span between the thumbs reads as a dense ordered-dither ramp; the rails
          outside read as a sparse wash. Thumbs may meet but never cross, and each
          is keyboard-operable (Arrows nudge by step, Shift+Arrows by ten, Home/End
          jump to the bound).
        </p>
        <DemoCard code={SNIPPET_RANGESLIDER}>
          <div className="mx-auto max-w-sm">
            <DitherRangeSlider value={range} onChange={setRange} min={0} max={100} showValues color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={RANGESLIDER_PROPS} />
      </section>

      {/* Segmented */}
      <section id="segmented" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Segmented</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An iOS-style segmented control — a row of mutually exclusive options whose
          active one is marked by a sliding dithered indicator that animates between
          positions. A radiogroup with roving tabindex; arrow keys walk the enabled
          options and Home/End jump to the ends.
        </p>
        <DemoCard code={SNIPPET_SEGMENTED}>
          <div className="mx-auto max-w-sm">
            <DitherSegmented segments={["Day", "Week", "Month"]} value={view} onChange={setView} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={SEGMENTED_PROPS} />
      </section>

      {/* Time picker */}
      <section id="time-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Time picker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Hour and minute scroll columns whose selected values carry the dithered
          fill. A 12-hour mode adds an AM/PM segmented toggle, and minuteStep snaps
          the granularity. The value is an &quot;HH:MM&quot; string or minutes-since-midnight.
        </p>
        <DemoCard code={SNIPPET_TIMEPICKER}>
          <div className="mx-auto max-w-sm">
            <DitherTimePicker value={time} onChange={(v) => setTime(String(v))} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={TIMEPICKER_PROPS} />
      </section>

      {/* Signature pad */}
      <section id="signature-pad" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Signature pad</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Pointer drawing on a canvas. The <code className="text-foreground/80">onChange</code> callback fires the dataURL
          after every stroke and on clear. A context-less environment refuses strokes instead of throwing, so degraded
          engines degrade visibly.
        </p>
        <DemoCard code={SNIPPET_SIGNATUREPAD}>
          <div className="mx-auto w-full max-w-md">
            <DitherSignaturePad height={140} />
          </div>
        </DemoCard>
        <PropsTable rows={SIGNATUREPAD_PROPS} />
      </section>

      {/* Dropzone */}
      <section id="dropzone" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Dropzone</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A file drop surface whose drag-over state intensifies as an ordered-dither
          wash — the surface visibly grabs in the kit&apos;s own pixels instead of
          flashing a flat highlight. Drops and the Browse button both feed a hidden
          file input; files are filtered by accept and maxSize, firing onFiles or
          onReject.
        </p>
        <DemoCard code={SNIPPET_DROPZONE}>
          <div className="mx-auto max-w-md">
            <DitherDropzone accept="image/*" label="Drop files here" hint="or click to browse" color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={DROPZONE_PROPS} />
      </section>

      {/* Image cropper */}
      <section id="image-cropper" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Image cropper</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A crop surface with an eight-handle box, pan, and wheel zoom. Drag a
          corner to re-anchor the opposite one; set <code className="text-foreground/80">aspect</code>{" "}
          to lock the width/height ratio (edges then recentre the perpendicular
          axis). The imperative ref exposes <code className="text-foreground/80">toDataURL()</code>{" "}
          so the host can export the current crop at native resolution.
        </p>
        <DemoCard code={SNIPPET_IMAGECROPPER}>
          <div className="mx-auto max-w-md">
            <DitherImageCropper src={CROPPER_SRC} aspect={16 / 9} label="Crop the image" />
          </div>
        </DemoCard>
        <PropsTable rows={IMAGECROPPER_PROPS} />
      </section>

      {/* Mention input */}
      <section id="mention-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Mention input</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Textarea with <code className="text-foreground/80">@</code>-mention autocomplete: detection is a regex on the
          text before the caret, the list anchors to the field, Arrow keys pick, Enter/Tab inserts, Escape closes. The
          caret lands after the inserted handle.
        </p>
        <DemoCard code={SNIPPET_MENTION}>
          <div className="mx-auto w-full max-w-md">
            <DitherMentionInput value={mention} onChange={setMention} options={MENTION_HANDLES} rows={3} />
          </div>
        </DemoCard>
        <PropsTable rows={MENTION_PROPS} />
      </section>

      {/* Shortcut recorder */}
      <section id="shortcut-recorder" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Shortcut recorder</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A keyboard-shortcut capture field. Click to arm, then press a real key
          to capture &mdash; modifier-only presses are rejected so a binding always
          names a key. The recorder emits a canonical chord such as{" "}
          <code className="text-foreground/80">Mod+Shift+K</code>, where Mod is the
          platform-primary modifier. Pass <code className="text-foreground/80">conflicts</code>{" "}
          to flag a binding that is already taken.
        </p>
        <DemoCard code={SNIPPET_SHORTCUT}>
          <div className="mx-auto max-w-sm">
            <DitherShortcutRecorder
              defaultChord="Mod+K"
              conflicts={["Mod+S", "Mod+C"]}
              placeholder="Click to record shortcut"
            />
          </div>
        </DemoCard>
        <PropsTable rows={SHORTCUT_PROPS} />
      </section>

      {/* Query builder */}
      <section id="query-builder" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Query builder</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A type-aware filter/query builder. Each rule picks a field, an operator,
          and a value; the operator set adapts to the field type (equals/contains for
          strings, range checks for numbers and dates, is/is-not for booleans), and
          an AND/OR combinator joins the flat rule stack you own. A string field with
          a fixed <code className="text-foreground/80">options</code> set renders a
          select instead of free text.
        </p>
        <DemoCard code={SNIPPET_QUERYBUILDER}>
          <div className="mx-auto max-w-md text-left">
            <DitherQueryBuilder fields={QUERY_FIELDS} value={queryRules} onChange={setQueryRules} combinator="and" color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={QUERYBUILDER_PROPS} />
      </section>

      {/* Color palette */}
      <section id="color-palette" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Color palette</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A swatch palette where every tile runs through the Bayer dither engine, so
          a designer previews how a colour reads at the kit&apos;s limited palette
          before committing it. Search by name or hex, copy on click, add a custom
          hex, and walk the grid with the arrow keys. Distinct from{" "}
          <code className="text-foreground/80">DitherColorPicker</code>, which is an
          HSV field with a hue rail.
        </p>
        <DemoCard code={SNIPPET_COLORPALETTE}>
          <div className="mx-auto max-w-md">
            <DitherColorPalette swatches={PALETTE_SWATCHES} value={paletteHex} onChange={setPaletteHex} label="Accent palette" />
          </div>
        </DemoCard>
        <PropsTable rows={COLORPALETTE_PROPS} />
      </section>

      {/* Filter chip */}
      <section id="filter-chip" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Filter chip</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A discrete filter chip that opens a popover of checkbox options. Idle it
          reads as a faint muted chip; selecting options ignites a Bayer-dithered
          border ramp that gets denser the more is selected, plus a count badge.
          Selection is draft-then-commit &mdash; toggles stage a local draft, Apply
          commits and closes, Clear empties, Escape reverts.
        </p>
        <DemoCard code={SNIPPET_FILTERCHIP}>
          <div className="mx-auto flex max-w-md justify-center">
            <DitherFilterChip label="Framework" options={FILTER_OPTIONS} value={filterPicked} onChange={setFilterPicked} />
          </div>
        </DemoCard>
        <PropsTable rows={FILTERCHIP_PROPS} />
      </section>

      {/* Slider 2D */}
      <section id="slider-2d" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Slider 2D</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A 2D trackpad / XY pad. A draggable thumb sits on a surface whose texture
          is a Bayer-dithered density map: the origin-to-value quadrant is dense, the
          rest faint. Drag with the pointer or nudge with the arrow keys (Shift jumps
          10%), and <code className="text-foreground/80">aria-valuetext</code>{" "}
          conveys both axes. Distinct from{" "}
          <code className="text-foreground/80">DitherSlider</code> (a 1D track).
        </p>
        <DemoCard code={SNIPPET_SLIDER2D}>
          <div className="mx-auto flex max-w-md justify-center">
            <DitherSlider2D value={sliderPos} onChange={setSliderPos} color="blue" label="Position" />
          </div>
        </DemoCard>
        <PropsTable rows={SLIDER2D_PROPS} />
      </section>

    </>
  );
}
