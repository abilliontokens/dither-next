"use client";

import { useState } from "react";

import {
  DitherBox,
  DitherClickOutside,
  DitherClipboard,
  DitherDivider,
  DitherFocusRing,
  DitherFocusScope,
  DitherHoverArea,
  DitherIcon,
  DitherIconSet,
  DitherImg,
  DitherInView,
  DitherMeasure,
  DitherOverlay,
  DitherPortal,
  DitherPressable,
  DitherSpacer,
  DitherSvg,
  DitherText,
  DitherVisuallyHidden,
  ICON_NAMES,
  type IconName,
} from "@dither-kit";

import { assetPath } from "@/shared/lib";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/**
 * PrimitivesDocs — the layout/behavior primitive section pack (Box through
 * IconSet). Port of `src/pages/docs/primitives/PrimitivesDocs.vue`.
 *
 * Section ids, classes and prose follow the Vue source; SNIPPET_* strings show
 * React/TSX usage of the kit (scoped slots → render-prop children, emits →
 * `on*` callbacks). One intentional demo deviation: the Overlay preview is
 * contained to its demo box (`relative isolate` container, `!absolute`
 * overlay) because this site renders every DemoCard on first paint, so the
 * upstream `!fixed` dim would cover the whole docs page.
 */
const SNIPPET_BOX = `<DitherBox as="section" className="rounded-lg border border-border/60 bg-card/40 p-5">
  <span className="text-[13px]">Content lands in a typed container.</span>
</DitherBox>`;

const SNIPPET_TEXT = `<DitherText tone="muted" size="sm">Default paragraph tone.</DitherText>
<DitherText as="span" tone="faint" size="xs">Caption-weight aside.</DitherText>
<DitherText as="h3" size="lg">A heading in the native scale.</DitherText>`;

const SNIPPET_DIVIDER = `<p>Charts render on canvas.</p>
<DitherDivider className="my-4" />
<p>Fills threshold the same Bayer matrix.</p>

{/* vertical: stretches inside a flex row */}
<div className="flex h-10 items-center gap-4">
  <span className="text-[12px]">Left</span>
  <DitherDivider orientation="vertical" />
  <span className="text-[12px]">Right</span>
</div>`;

const SNIPPET_HIDDEN = `<DitherVisuallyHidden>
  Extra context that only a screen reader should read.
</DitherVisuallyHidden>

{/* focusable: the skip-link pattern — Tab reveals it */}
<DitherVisuallyHidden focusable>Skip to content</DitherVisuallyHidden>`;

const SNIPPET_SVG = `{/* decorative by default: aria-hidden */}
<DitherSvg viewBox="0 0 24 24" className="size-5">
  <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="2" />
</DitherSvg>

{/* labeled: promoted to role=img with a name */}
<DitherSvg viewBox="0 0 24 24" label="Close" className="size-4">…</DitherSvg>`;

const SNIPPET_IMG = `{/* loading contract built in; alt is required */}
<DitherImg src={assetPath("/sprites.webp")} alt="The sprite sheet" className="h-40 w-full object-cover" />`;

const SNIPPET_SPACER = `<div className="flex items-center">
  <span className="text-[12px]">Left</span>
  <DitherSpacer axis="x" size="lg" />
  <span className="text-[12px]">Right</span>
</div>`;

const SNIPPET_PORTAL = `<DitherPortal to="body">
  <div className="fixed bottom-4 right-4">Rendered at the end of body.</div>
</DitherPortal>

{/* keep it in place (SSR / tests) */}
<DitherPortal disabled>Inline.</DitherPortal>`;

const SNIPPET_OVERLAY = `{/* decorative dim: clicks pass through */}
<DitherOverlay dim="medium" />

{/* interactive scrim: catches presses, keeps its children reachable */}
<DitherOverlay dim="soft" interactive onClick={() => setOpen(false)} />`;

const SNIPPET_MEASURE = `<DitherMeasure className="w-48" onResize={onResize}>
  <div className="h-20 rounded border" />
</DitherMeasure>

function onResize({ width, height }: { width: number; height: number }) {
  console.log(width, height)
}`;

const SNIPPET_CLIPBOARD = `<DitherClipboard value="npm i d3-scale d3-shape clsx">
  {/* render-prop child wraps the trigger: copied + copy land right here */}
  {({ copied }) => (
    <button type="button" className="rounded border px-3 py-1.5 text-[11px]">
      {copied ? "copied" : "copy install"}
    </button>
  )}
</DitherClipboard>`;

const SNIPPET_CLICK_OUTSIDE = `const [open, setOpen] = useState(false)

<DitherClickOutside enabled={open} onOutside={() => setOpen(false)}>
  <button type="button" onClick={() => setOpen(!open)}>menu</button>
  {open && <div className="mt-2 rounded border p-2">…</div>}
</DitherClickOutside>`;

const SNIPPET_FOCUS_RING = `<DitherFocusRing className="inline-flex gap-2 p-1">
  <button type="button">First</button>
  <button type="button">Second</button>
</DitherFocusRing>`;

const SNIPPET_FOCUS_SCOPE = `{dialog && (
  <DitherFocusScope onKeyDown={(e) => e.key === "Escape" && setDialog(false)}>
    <h2 tabIndex={-1}>Confirm</h2>
    <button type="button">Yes</button>
    <button type="button">No</button>
  </DitherFocusScope>
)}
{/* focus enters on open, Tab cycles inside, returns to the opener on close */}`;

const SNIPPET_HOVER_AREA = `<DitherHoverArea>
  {({ hovered, focused }) => (
    <div className={hovered || focused ? "rounded border border-foreground p-4" : "rounded border border-border/60 p-4"}>
      Reveal on hover — or on keyboard focus.
    </div>
  )}
</DitherHoverArea>`;

const SNIPPET_PRESSABLE = `<DitherPressable className="rounded-md border px-3 py-1.5 text-[11px]">
  Plain, native, presses down
</DitherPressable>`;

const SNIPPET_IN_VIEW = `<DitherInView once>
  {({ inView }) => (
    <div className={\`h-40 rounded border transition-opacity \${inView ? "opacity-100" : "opacity-0"}\`}>
      Reveals its state when it approaches the viewport.
    </div>
  )}
</DitherInView>`;

const SNIPPET_ICON = `{/* decorative by default */}
<DitherIcon name="Search" size={20} />

{/* labeled: promoted to role=img with a name */}
<DitherIcon name="Close" label="Dismiss" size={18} />

{/* currentColor inherits; weight rides on strokeWidth */}
<DitherIcon name="Trash" size={24} strokeWidth={1.5} className="text-red-400" />`;

const SNIPPET_ICON_SET = `{/* once, near the app root */}
<DitherIconSet />

{/* then anywhere: one symbol, many uses */}
<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
  <use href="#di-icon-Star" />
</svg>`;

const API: Record<string, PropRow[]> = {
  box: [{ prop: "as", type: '"div" | "section" | "span" | "article" | …', default: '"div"' }],
  text: [
    { prop: "as", type: '"p" | "span" | "h3" | "li" | …', default: '"p"' },
    { prop: "tone", type: '"default" | "muted" | "faint"', default: '"default"' },
    { prop: "size", type: '"xs" | "sm" | "md" | "lg" (11–15px)', default: "" },
  ],
  divider: [{ prop: "orientation", type: '"horizontal" | "vertical"', default: '"horizontal"' }],
  visuallyHidden: [{ prop: "focusable", type: "boolean", default: "false" }],
  icon: [
    { prop: "name", type: "IconName (glyph list in icons.ts)", default: "required" },
    { prop: "size", type: "number (px)", default: "16" },
    { prop: "label", type: "string (promotes to role=img)", default: "" },
    { prop: "strokeWidth", type: "number", default: "2" },
  ],
  iconSet: [{ prop: "use", type: 'via <use href="#di-icon-Name">', default: "" }],
  svg: [
    { prop: "viewBox", type: "string", default: "" },
    { prop: "label", type: "string (promotes to role=img)", default: "" },
  ],
  img: [
    { prop: "src", type: "string", default: "required" },
    { prop: "alt", type: "string (empty string = decorative)", default: "required" },
    { prop: "loading", type: '"lazy" | "eager"', default: '"lazy"' },
    { prop: "decoding", type: '"async" | "auto" | "sync"', default: '"async"' },
  ],
  spacer: [
    { prop: "axis", type: '"y" | "x"', default: '"y"' },
    { prop: "size", type: '"xs" | "sm" | "md" | "lg" | "xl" (4–40px)', default: '"md"' },
  ],
  portal: [
    { prop: "to", type: "string (selector)", default: '"body"' },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  overlay: [
    { prop: "dim", type: '"none" | "soft" | "medium" | "strong"', default: '"soft"' },
    { prop: "interactive", type: "boolean", default: "false" },
  ],
  measure: [{ prop: "onResize", type: "({ width, height }) => void", default: "on box change" }],
  clipboard: [
    { prop: "value", type: "string", default: "required" },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "onCopied", type: "(value: string) => void", default: "on success" },
  ],
  clickOutside: [
    { prop: "enabled", type: "boolean", default: "true" },
    { prop: "onOutside", type: "(event: Event) => void — pointerdown outside", default: "" },
  ],
  focusRing: [],
  focusScope: [
    { prop: "autofocus", type: "boolean", default: "true" },
    { prop: "trapped", type: "boolean", default: "true" },
    { prop: "restoreFocus", type: "boolean", default: "true" },
  ],
  hoverArea: [{ prop: "children (render prop)", type: "({ hovered, focused }) => ReactNode", default: "" }],
  pressable: [{ prop: "type", type: '"button" | "submit" | "reset"', default: '"button"' }],
  inView: [
    { prop: "rootMargin", type: "string", default: '"200px"' },
    { prop: "threshold", type: "number", default: "0" },
    { prop: "once", type: "boolean", default: "true" },
    { prop: "children (render prop)", type: "({ inView }) => ReactNode", default: "" },
  ],
};

const SPRITE_DEMO: IconName[] = ["Star", "Heart", "Bell", "Bookmark"];

const LINK_CLASS = "text-foreground/80 underline decoration-border underline-offset-4 hover:decoration-foreground/60";
const TRIGGER_CLASS =
  "rounded-md border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground";

export function PrimitivesDocs() {
  // Demo state for the interactive primitive sections.
  const [measured, setMeasured] = useState("not measured yet");
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  return (
    <>
      <section id="box" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Box</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          One element, one job: a typed container whose whole style arrives as{" "}
          <code className="text-foreground/80">className</code>. Swap the tag with{" "}
          <code className="text-foreground/80">as</code> (landmarks for structure, spans for inline flow) and the
          children never notice.
        </p>
        <DemoCard code={SNIPPET_BOX}>
          <DitherBox as="section" className="rounded-lg border border-border/60 bg-card/40 p-5 text-center">
            <span className="text-[13px] text-foreground/90">Content lands in a typed container.</span>
          </DitherBox>
        </DemoCard>
        <PropsTable rows={API.box} />
      </section>

      <section id="text" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Text</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The type scale the whole site speaks: three token tones, four sizes from 11 to 15px, and{" "}
          <code className="text-foreground/80">as</code> for the element. Leading, tracking and weight stay yours in{" "}
          <code className="text-foreground/80">className</code>.
        </p>
        <DemoCard code={SNIPPET_TEXT}>
          <div className="grid gap-3 text-left">
            <DitherText tone="muted" size="sm">
              Default paragraph tone.
            </DitherText>
            <DitherText as="span" tone="faint" size="xs">
              Caption-weight aside.
            </DitherText>
            <DitherText as="h3" size="lg">
              A heading in the native scale.
            </DitherText>
          </div>
        </DemoCard>
        <PropsTable rows={API.text} />
      </section>

      <section id="divider" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Divider</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A hairline rule with real separator semantics. Horizontal renders an{" "}
          <code className="text-foreground/80">hr</code>; vertical lives in flex rows and stretches to their height.
          Both announce their orientation.
        </p>
        <DemoCard code={SNIPPET_DIVIDER}>
          <div className="mx-auto w-full max-w-sm">
            <DitherText size="sm" tone="muted" className="text-center">
              Charts render on canvas.
            </DitherText>
            <DitherDivider className="my-4" />
            <DitherText size="sm" tone="muted" className="text-center">
              Fills threshold the same Bayer matrix.
            </DitherText>
            <div className="mt-6 flex h-10 items-center justify-center gap-4">
              <span className="text-[12px] text-foreground/90">Left</span>
              <DitherDivider orientation="vertical" />
              <span className="text-[12px] text-foreground/90">Right</span>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.divider} />
      </section>

      <section id="visually-hidden" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">VisuallyHidden</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Content for screen readers only: labels that must exist in the reading order without painting anything.
          Flip on <code className="text-foreground/80">focusable</code> for the skip-link pattern: Tab reveals it,
          styled as a chip over the page.
        </p>
        <DemoCard code={SNIPPET_HIDDEN}>
          <div className="grid justify-items-center gap-3">
            <p className="text-[12px] text-muted-foreground">
              Extra context that only a screen reader should read
              <DitherVisuallyHidden> (this sentence is announced, not painted)</DitherVisuallyHidden>
            </p>
            <a
              href="#box"
              className="rounded border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Tab to reveal the skip link
            </a>
            <DitherVisuallyHidden focusable>Skip to content</DitherVisuallyHidden>
          </div>
        </DemoCard>
        <PropsTable rows={API.visuallyHidden} />
      </section>

      <section id="svg" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Svg</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A neutral SVG shell: no imposed stroke language, so the kit&apos;s art direction stays inside the
          components. Decorative by default (<code className="text-foreground/80">aria-hidden</code>); a{" "}
          <code className="text-foreground/80">label</code> promotes it to{" "}
          <code className="text-foreground/80">role=&quot;img&quot;</code> with a name.
        </p>
        <DemoCard code={SNIPPET_SVG}>
          <div className="flex items-center justify-center gap-6">
            <DitherSvg viewBox="0 0 24 24" className="size-6 text-foreground/80">
              <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="2" />
            </DitherSvg>
            <DitherSvg viewBox="0 0 24 24" label="Plus" className="size-8 text-foreground">
              <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.5" />
            </DitherSvg>
          </div>
        </DemoCard>
        <PropsTable rows={API.svg} />
      </section>

      <section id="img" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Image</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The plain <code className="text-foreground/80">img</code> with the modern loading contract baked in: lazy,
          async decode, and a required <code className="text-foreground/80">alt</code> (empty string is the explicit
          decorative choice). For the ordered-dither renderer see{" "}
          <a href="#image" className={LINK_CLASS}>
            Image
          </a>{" "}
          in Components.
        </p>
        <DemoCard code={SNIPPET_IMG}>
          <DitherImg
            src={assetPath("/sprites.webp")}
            alt="The dither-ui sprite sheet"
            className="h-40 w-full rounded-md object-cover"
          />
        </DemoCard>
        <PropsTable rows={API.img} />
      </section>

      <section id="spacer" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Spacer</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sized empty space for flex and grid rows, the alternative to magic margins. Two axes, five steps from 4 to
          40px, always decorative.
        </p>
        <DemoCard code={SNIPPET_SPACER}>
          <div className="flex items-center justify-center rounded-md border border-border/60 p-4">
            <span className="text-[12px] text-foreground/90">Left</span>
            <DitherSpacer axis="x" size="lg" />
            <span className="text-[12px] text-foreground/90">Right</span>
            <DitherSpacer axis="x" size="xs" />
            <span className="text-[12px] text-muted-foreground">tight</span>
          </div>
        </DemoCard>
        <PropsTable rows={API.spacer} />
      </section>

      <section id="portal" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Portal</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Teleport by name: render children elsewhere in the DOM so popovers and toasts escape{" "}
          <code className="text-foreground/80">overflow: hidden</code>.{" "}
          <code className="text-foreground/80">disabled</code> keeps it in place (the switch for tests and
          environments where the target does not exist).
        </p>
        <DemoCard code={SNIPPET_PORTAL}>
          <div className="rounded-md border border-border/60 p-4 text-center text-[12px] text-muted-foreground">
            The demo renders a chip into <code className="text-foreground/80">body</code>, outside every scroll
            container on this page.
          </div>
          <DitherPortal to="body">
            <div className="pointer-events-none fixed bottom-4 right-4 z-30 rounded-md border border-border/60 bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
              teleported to body
            </div>
          </DitherPortal>
        </DemoCard>
        <PropsTable rows={API.portal} />
      </section>

      <section id="overlay" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Overlay</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A full-cover layer in four dim weights. Decorative and click-transparent by default;{" "}
          <code className="text-foreground/80">interactive</code> makes it catch presses (dismissible scrims) and
          lifts the aria-hidden so its children stay reachable.
        </p>
        <DemoCard code={SNIPPET_OVERLAY}>
          {/* Contained to this box (relative + isolate container, !absolute overlay): the kit's
              fixed inset-0 z-40 layer would otherwise dim the whole docs page from first paint. */}
          <div className="relative isolate grid h-40 place-items-center rounded-md border border-border/60 bg-card/40 text-center">
            <span className="text-[12px] text-muted-foreground">content under the dim</span>
            <DitherOverlay dim="medium" className="!absolute rounded-md" />
          </div>
        </DemoCard>
        <PropsTable rows={API.overlay} />
      </section>

      <section id="measure" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Measure</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Reports its own box: a plain block that calls <code className="text-foreground/80">onResize</code> with
          width and height on every change. ResizeObserver only: without it the children still render and the
          block simply stays silent.
        </p>
        <DemoCard code={SNIPPET_MEASURE}>
          <div className="grid justify-items-center gap-3">
            <DitherMeasure
              className="w-48"
              onResize={({ width, height }) => setMeasured(`${width} × ${height}`)}
            >
              <div className="h-20 w-full rounded-md border border-border/60 bg-card/40" />
            </DitherMeasure>
            <span className="text-[11px] tabular-nums text-muted-foreground">{measured}</span>
          </div>
        </DemoCard>
        <PropsTable rows={API.measure} />
      </section>

      <section id="clipboard" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Clipboard</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Clipboard behavior around any trigger: the render-prop child gets{" "}
          <code className="text-foreground/80">copied</code> and <code className="text-foreground/80">copy</code>,
          and a polite live region announces the result. Your trigger keeps its own semantics. This adds the behavior
          and the announcement.
        </p>
        <DemoCard code={SNIPPET_CLIPBOARD}>
          <div className="flex justify-center">
            <DitherClipboard value="npm i d3-scale d3-shape clsx">
              {({ copied }) => (
                <button type="button" className={TRIGGER_CLASS}>
                  {copied ? "copied ✓" : "copy install command"}
                </button>
              )}
            </DitherClipboard>
          </div>
        </DemoCard>
        <PropsTable rows={API.clipboard} />
      </section>

      <section id="click-outside" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">ClickOutside</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          One <code className="text-foreground/80">onOutside</code> call when a primary press lands anywhere beyond
          the wrapped content: capture-phase <code className="text-foreground/80">pointerdown</code>, so nested
          scroll containers and shadowed children are handled by containment, not by guessing.
        </p>
        <DemoCard code={SNIPPET_CLICK_OUTSIDE}>
          <div className="flex justify-center">
            <DitherClickOutside enabled={demoMenuOpen} onOutside={() => setDemoMenuOpen(false)}>
              <div className="grid gap-2">
                <button type="button" className={TRIGGER_CLASS} onClick={() => setDemoMenuOpen((open) => !open)}>
                  {demoMenuOpen ? "menu open: click anywhere outside" : "open the menu"}
                </button>
                {demoMenuOpen && (
                  <div className="rounded-md border border-border/60 bg-card p-2 text-[11px] text-muted-foreground">
                    Pressing outside closes this.
                  </div>
                )}
              </div>
            </DitherClickOutside>
          </div>
        </DemoCard>
        <PropsTable rows={API.clickOutside} />
      </section>

      <section id="focus-ring" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">FocusRing</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Container-level focus: wraps a control group and rings while anything inside holds focus, so keyboard users
          see which group is active. The individual control keeps the global{" "}
          <code className="text-foreground/80">:focus-visible</code> floor.
        </p>
        <DemoCard code={SNIPPET_FOCUS_RING}>
          <div className="flex justify-center">
            <DitherFocusRing className="inline-flex gap-2 rounded-md p-1">
              <button
                type="button"
                className="rounded border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground"
              >
                First
              </button>
              <button
                type="button"
                className="rounded border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground"
              >
                Second
              </button>
            </DitherFocusRing>
          </div>
        </DemoCard>
        <PropsTable rows={API.focusRing} />
      </section>

      <section id="focus-scope" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">FocusScope</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The modal focus contract in one component: focus enters on mount,{" "}
          <code className="text-foreground/80">Tab</code> cycles inside the scope, and closing hands focus back to
          whatever had it. Every dialog in the kit obeys exactly these three rules.
        </p>
        <DemoCard code={SNIPPET_FOCUS_SCOPE}>
          <div className="grid justify-items-center gap-3">
            <button type="button" className={TRIGGER_CLASS} onClick={() => setScopeOpen((open) => !open)}>
              {scopeOpen ? "close (focus returns to me)" : "open a focus scope"}
            </button>
            {scopeOpen && (
              <DitherFocusScope className="grid gap-2 rounded-md border border-border/60 bg-card p-4 text-center">
                <h3 tabIndex={-1} className="text-[12px] text-foreground">
                  Scope active
                </h3>
                <div className="flex justify-center gap-2">
                  <button type="button" className="rounded border border-border/60 px-3 py-1 text-[11px]">
                    Yes
                  </button>
                  <button type="button" className="rounded border border-border/60 px-3 py-1 text-[11px]">
                    No
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">Tab cycles here, nowhere else</span>
              </DitherFocusScope>
            )}
          </div>
        </DemoCard>
        <PropsTable rows={API.focusScope} />
      </section>

      <section id="hover-area" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">HoverArea</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Hover state as render-prop data: no refs, no listener bookkeeping. Keyboard focus tracks alongside the
          pointer so the reveal is the same for everyone.
        </p>
        <DemoCard code={SNIPPET_HOVER_AREA}>
          <DitherHoverArea className="mx-auto max-w-sm">
            {({ hovered, focused }) => (
              <div
                className={`rounded-md border p-4 text-center text-[12px] transition-colors ${
                  hovered || focused ? "border-foreground text-foreground" : "border-border/60 text-muted-foreground"
                }`}
              >
                {hovered || focused ? "revealed" : "hover or tab onto this"}
              </div>
            )}
          </DitherHoverArea>
        </DemoCard>
        <PropsTable rows={API.hoverArea} />
      </section>

      <section id="pressable" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pressable</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The plainest interactive base: a native button (never submits a form by accident) with the house press
          affordance and the global focus floor. For the dithered, blooming version see{" "}
          <a href="#button" className={LINK_CLASS}>
            DitherButton
          </a>
          .
        </p>
        <DemoCard code={SNIPPET_PRESSABLE}>
          <div className="flex justify-center gap-3">
            <DitherPressable className="rounded-md border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
              Plain, native, presses down
            </DitherPressable>
            <DitherPressable disabled className="rounded-md border border-border/60 px-3 py-1.5 text-[11px] opacity-50">
              Disabled
            </DitherPressable>
          </div>
        </DemoCard>
        <PropsTable rows={API.pressable} />
      </section>

      <section id="in-view" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">InView</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The taxonomy&apos;s IntersectionObserver primitive, named for what it does: visibility as render-prop
          state. <code className="text-foreground/80">once</code> latches after the first enter (the lazy-reveal
          shape this whole page runs on). Degraded engines see content, never an empty box.
        </p>
        <DemoCard code={SNIPPET_IN_VIEW}>
          <DitherInView once className="grid h-40 place-items-center">
            {({ inView }) => (
              <div
                className={`grid h-full w-full place-items-center rounded-md border border-border/60 transition-opacity duration-500 ${
                  inView ? "bg-card/40 opacity-100" : "opacity-0"
                }`}
              >
                <span className="text-[12px] text-muted-foreground">
                  {inView ? "in view ✓" : "waiting for the viewport…"}
                </span>
              </div>
            )}
          </DitherInView>
        </DemoCard>
        <PropsTable rows={API.inView} />
      </section>

      <section id="icon" className="mt-16 scroll-mt-24">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg tracking-tight">Icon</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">{ICON_NAMES.length} glyphs</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The hand-rolled set: 24×24 stroke geometry, currentColor, round caps. One source in{" "}
          <code className="text-foreground/80">icons.ts</code>, no dependencies. Decorative by default; a{" "}
          <code className="text-foreground/80">label</code> names it for screen readers. Unknown names throw instead
          of rendering an empty box.
        </p>
        <DemoCard code={SNIPPET_ICON}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {ICON_NAMES.map((n) => (
              <div
                key={n}
                className="grid justify-items-center gap-1.5 rounded-md border border-border/60 bg-card/30 px-1 py-3"
              >
                <DitherIcon name={n} size={20} className="text-foreground/90" />
                <span className="w-full truncate text-center text-[9px] text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </DemoCard>
        <PropsTable rows={API.icon} />
      </section>

      <section id="icon-set" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">IconSet</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The same set as <code className="text-foreground/80">&lt;symbol&gt;</code> sheets: mount once and reference
          glyphs with <code className="text-foreground/80">&lt;use href=&quot;#di-icon-Name&quot;&gt;</code> when a
          screen repeats icons enough to care. Opt-in: <code className="text-foreground/80">DitherIcon</code> never
          needs it.
        </p>
        <DemoCard code={SNIPPET_ICON_SET}>
          <div className="grid justify-items-center gap-4">
            <div className="flex items-center gap-5 text-foreground/90">
              {SPRITE_DEMO.map((name) => (
                <svg key={name} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <use href={`#di-icon-${name}`} />
                </svg>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">four symbols, one sprite</span>
            <DitherIconSet />
          </div>
        </DemoCard>
        <PropsTable rows={API.iconSet} />
      </section>
    </>
  );
}
