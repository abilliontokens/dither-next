"use client";

import { useState } from "react";

import {
  DitherBreadcrumb,
  DitherCarousel,
  DitherOutline,
  DitherPagination,
  DitherRating,
  DitherStepper,
  DitherTimeline,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

const SNIPPET_BREADCRUMB = `<DitherBreadcrumb
  items={[
    { label: 'Home', href: '#/' },
    { label: 'Components', href: '#/docs' },
    { label: 'Breadcrumb' },
  ]}
/>`;

const SNIPPET_PAGINATION = `<DitherPagination page={page} onPageChange={setPage} total={12} />`;

const SNIPPET_RATING = `{/* interactive: click or arrow-key to set */}
<DitherRating value={rating} onChange={setRating} />

{/* read-only supports fractions */}
<DitherRating value={4.5} readonly />

{/* seed varies the star tilt + dither scatter */}
<DitherRating value={4} seed={88} color="pink" />`;

const SNIPPET_STEPPER = `<DitherStepper
  current={1}
  steps={[
    { label: 'Cart' },
    { label: 'Shipping' },
    { label: 'Payment' },
    { label: 'Done' },
  ]}
/>`;

const SNIPPET_TIMELINE = `<DitherTimeline
  items={[
    { title: 'Deployed v0.3.0', time: '2h ago', color: 'green',
      body: 'Rolled out to production.' },
    { title: 'Merged #482', time: 'Yesterday', color: 'blue',
      body: 'Seeded spinner form space.' },
    { title: 'Opened milestone', time: 'Mon', color: 'purple' },
  ]}
/>`;

const SNIPPET_CAROUSEL = `<DitherCarousel color="green" loop autoplay interval={4000} label="Showcase">
  <img src="/prints.webp" alt="Prints" />
  <img src="/frames.webp" alt="Frames" />
  <img src="/zines.webp" alt="Zines" />
</DitherCarousel>
{/* scroll-snap track · mouse drag with flick landing · dithered pagination */}`;

const API: Record<string, PropRow[]> = {
  breadcrumb: [
    { prop: "items", type: "{ label; href? }[]", default: "—" },
    { prop: "separator", type: "string", default: '"/"' },
  ],
  pagination: [
    { prop: "page", type: "number (value/onChange)", default: "—" },
    { prop: "total", type: "number — page count", default: "—" },
    { prop: "siblings", type: "number — pages either side", default: "1" },
  ],
  rating: [
    { prop: "value", type: "number (value/onChange)", default: "0" },
    { prop: "max", type: "number", default: "5" },
    { prop: "color", type: "PixelColor", default: '"orange"' },
    { prop: "size", type: "number (px per star)", default: "22" },
    { prop: "readonly", type: "boolean — fractions allowed", default: "false" },
    { prop: "label", type: "string — accessible name", default: '"Rating"' },
    { prop: "seed", type: "number — star tilt + scatter", default: "clean" },
  ],
  stepper: [
    { prop: "steps", type: "{ label; hint? }[]", default: "—" },
    { prop: "current", type: "number — active index", default: "—" },
  ],
  timeline: [
    { prop: "items", type: "{ title; time?; body?; color? }[]", default: "—" },
    { prop: "dotSize", type: "number (px)", default: "12" },
  ],
  carousel: [
    { prop: "children", type: "slides (each wrapped role=group)", default: "—" },
    { prop: "index", type: "number (controlled)", default: "internal" },
    { prop: "loop", type: "boolean — wrap at the ends", default: "false" },
    { prop: "autoplay", type: "boolean — pauses on hover/focus", default: "false" },
    { prop: "interval", type: "number (ms)", default: "4000" },
    { prop: "color", type: "PixelColor — pagination dots", default: '"blue"' },
    { prop: "label", type: "string — region name", default: '"Carousel"' },
  ],
};

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "#/" },
  { label: "Components", href: "#/docs" },
  { label: "Breadcrumb" },
];

const STEPPER_STEPS = [
  { label: "Cart" },
  { label: "Shipping" },
  { label: "Payment" },
  { label: "Done" },
];

const TIMELINE_ITEMS = [
  { title: "Deployed v0.3.0", time: "2h ago", color: "green", body: "Rolled out to production behind a flag." },
  { title: "Merged #482", time: "Yesterday", color: "blue", body: "Seeded the spinner form space." },
  { title: "Opened milestone", time: "Mon", color: "purple", body: "Navigation & data components." },
  { title: "Kicked off", time: "Last week", color: "orange" },
];

const SEED_COLORS = ["orange", "pink", "purple", "green"] as const;

const SNIPPET_OUTLINE = `<DitherOutline items={items} offset={80} color="blue" />
{/* scroll-spy TOC · each item.id resolves to a heading · active row drives a
    downward-fading Bayer progress rail · click/Enter to smooth-scroll */}`;

const OUTLINE_PROPS: PropRow[] = [
  { prop: "items", type: "DitherOutlineItem[] — { id, label, depth? }", default: "required" },
  { prop: "offset", type: "number (px) — scroll + active offset", default: "0" },
  { prop: "onNavigate", type: "(id: string) => void", default: "—" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const OUTLINE_ITEMS = [
  { id: "ov-getting-started", label: "Quick start" },
  { id: "ov-styling", label: "Styling" },
  { id: "ov-seeds", label: "Seeds" },
  { id: "ov-motion", label: "Animation" },
  { id: "ov-a11y", label: "Accessibility" },
];

export function NavigationDocs() {
  const [page, setPage] = useState(3);
  const [rating, setRating] = useState(3);
  const [ratingSeeds, setRatingSeeds] = useState<number[]>([0, 12, 88, 404]);

  const rerollRatings = () => {
    setRatingSeeds((prev) => prev.map(() => Math.floor(Math.random() * 100000)));
  };

  return (
    <>
      {/* Breadcrumb */}
      <section id="breadcrumb" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Breadcrumb</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A path back up the hierarchy. Links up to the current page, which is marked
          <code className="text-foreground/80">aria-current{`{"\""}`}page{`{"\""}`}</code>, inside a labelled
          <code className="text-foreground/80">nav</code>.
        </p>
        <DemoCard code={SNIPPET_BREADCRUMB}>
          <div className="flex justify-center">
            <DitherBreadcrumb items={BREADCRUMB_ITEMS} />
          </div>
        </DemoCard>
        <PropsTable rows={API.breadcrumb} />
      </section>

      {/* Pagination */}
      <section id="pagination" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pagination</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Page navigation that always shows the first, last and current page, collapsing
          the rest to ellipses. Controlled with <code className="text-foreground/80">page</code> and <code className="text-foreground/80">onPageChange</code>.
        </p>
        <DemoCard code={SNIPPET_PAGINATION}>
          <div className="grid gap-4">
            <div className="flex justify-center">
              <DitherPagination page={page} total={12} onPageChange={setPage} />
            </div>
            <p className="text-center text-[12px] text-muted-foreground">on page {page} of 12</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.pagination} />
      </section>

      {/* Rating */}
      <section id="rating" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Rating</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Dithered stars, rasterised from a 5-point polygon and scattered through the Bayer
          matrix. Interactive as a <code className="text-foreground/80">slider</code> (click or arrow
          keys); read-only mode fills fractionally. A seed tilts the star and reshuffles the
          scatter, so no two ratings look stamped from the same die.
        </p>
        <DemoCard code={SNIPPET_RATING}>
          <div className="grid gap-6">
            <div className="flex flex-col items-center gap-2">
              <DitherRating value={rating} size={28} onChange={setRating} />
              <p className="text-[12px] tabular-nums text-muted-foreground">{rating} / 5 — click or arrow-key</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <DitherRating value={4.5} readonly />
              <DitherRating value={3} readonly color="green" />
              <DitherRating value={5} readonly color="pink" max={5} />
              <DitherRating value={7} readonly color="blue" max={10} size={16} />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-6">
                {ratingSeeds.map((sd, i) => (
                  <DitherRating
                    key={i}
                    value={4}
                    readonly
                    seed={sd}
                    color={SEED_COLORS[i]}
                    size={24}
                  />
                ))}
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                onClick={rerollRatings}
              >
                Reroll star seeds
              </button>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.rating} />
      </section>

      {/* Stepper */}
      <section id="stepper" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Stepper</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Progress through a multi-step flow. Completed steps carry a check, the current step
          an outlined node, and the connectors are the kit{'\''}s dithered rule — dissolving toward
          steps not yet reached.
        </p>
        <DemoCard code={SNIPPET_STEPPER}>
          <div className="mx-auto max-w-md">
            <DitherStepper current={1} steps={STEPPER_STEPS} />
          </div>
        </DemoCard>
        <PropsTable rows={API.stepper} />
      </section>

      {/* Timeline */}
      <section id="timeline" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Timeline</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A vertical run of events, each pinned by a dithered dot whose density fades at the
          rim. Give a title, an optional timestamp, body and palette colour per node.
        </p>
        <DemoCard code={SNIPPET_TIMELINE}>
          <div className="mx-auto max-w-sm">
            <DitherTimeline items={TIMELINE_ITEMS} />
          </div>
        </DemoCard>
        <PropsTable rows={API.timeline} />
      </section>
      <section id="carousel" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Carousel</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A snap carousel — a CSS scroll-snap track (one slide per view) with mouse
          pointer-drag, velocity-projected flick landing, dithered pixel-square
          pagination, and prev/next controls. Autoplay pauses on hover/focus and stops
          entirely under reduced motion; touch stays native.
        </p>
        <DemoCard code={SNIPPET_CAROUSEL}>
          <div className="mx-auto max-w-md">
            <DitherCarousel color="green" loop autoplay interval={4000} label="Showcase">
              {["Prints", "Frames", "Zines"].map((s) => (
                <div key={s} className="grid h-40 w-full place-items-center rounded-lg border border-border/60 bg-card text-sm text-muted-foreground">
                  {s}
                </div>
              ))}
            </DitherCarousel>
          </div>
        </DemoCard>
        <PropsTable rows={API.carousel} />
      </section>

      {/* Outline */}
      <section id="outline" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Outline</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A scroll-spy table of contents. Each <code className="text-foreground/80">item.id</code>{" "}
          is resolved to a heading in the document, the active row drives a
          downward-fading Bayer progress rail, and clicking or pressing Enter
          smooth-scrolls to that heading. The progress rail grows with scroll
          position so the reader always sees how far the page goes.
        </p>
        <DemoCard code={SNIPPET_OUTLINE}>
          <div className="mx-auto max-w-xs">
            <DitherOutline items={OUTLINE_ITEMS} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={OUTLINE_PROPS} />
      </section>

    </>
  );
}
