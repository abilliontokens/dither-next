"use client";

import { useState } from "react";

import {
  DitherAvatar,
  DitherBadge,
  DitherButton,
  DitherCommand,
  DitherCommandQueue,
  DitherContextMenu,
  DitherMenu,
  DitherMenubar,
  DitherPopover,
  DitherPreviewCard,
  DitherRadialMenu,
  DitherTooltip,
  DitherBottomSheet,
  DitherHoverCard,
  DitherTour,
  type QueueToast,
} from "@dither-kit";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

const MENU_ITEMS = [
  { label: "New" },
  { label: "Duplicate" },
  { divider: true },
  { label: "Delete", danger: true },
];

const CTX_ITEMS = [
  { label: "Cut" },
  { label: "Copy" },
  { label: "Paste" },
  { divider: true },
  { label: "Delete", danger: true },
];

const MENUBAR = [
  {
    label: "File",
    items: [{ label: "New" }, { label: "Open" }, { label: "Save" }],
  },
  {
    label: "Edit",
    items: [{ label: "Undo" }, { label: "Redo" }, { label: "Find" }],
  },
  {
    label: "View",
    items: [{ label: "Zoom in" }, { label: "Zoom out" }],
  },
];

const SNIPPET_POPOVER = `<DitherPopover open={open} align="center" onClose={() => setOpen(false)}>
  trigger={
    <DitherButton onClick={() => setOpen(!open)}>Open popover</DitherButton>
  }
  <p className="text-[12px] leading-relaxed text-muted-foreground">
    Anchored to its trigger — Escape or an outside press closes it.
  </p>
</DitherPopover>`;

const SNIPPET_MENU = `<DitherMenu items={items} onSelect={(label) => run(label)}>
  Actions
</DitherMenu>`;

const SNIPPET_CONTEXT = `<DitherContextMenu items={items} onSelect={(label) => run(label)}>
  <div className="rounded-lg border border-dashed border-border p-10">
    right-click me
  </div>
</DitherContextMenu>`;

const SNIPPET_MENUBAR = `const menus = [
  { label: "File", items: [{ label: "New" }, { label: "Open" }, { label: "Save" }] },
  { label: "Edit", items: [{ label: "Undo" }, { label: "Redo" }, { label: "Find" }] },
  { label: "View", items: [{ label: "Zoom in" }, { label: "Zoom out" }] },
]
const [last, setLast] = useState("none")

<DitherMenubar menus={menus} onSelect={(m, i) => setLast(\`\${m} → \${i}\`)} />
<p className="mt-3 text-[12px] text-muted-foreground">last action: {last}</p>`;

const SNIPPET_TOOLTIP = `<DitherTooltip text="Deploys are frozen until Monday">
  <DitherBadge color="orange">frozen</DitherBadge>
</DitherTooltip>`;

const SNIPPET_PREVIEW = `<DitherPreviewCard
  trigger={
    <span className="underline decoration-border underline-offset-4" tabIndex={0}>
      @ada
    </span>
  }
>
  <div className="flex items-center gap-3">
    <DitherAvatar name="Ada Lovelace" size={40} />
    <div>
      <p className="text-[13px]">Ada Lovelace</p>
      <p className="text-[11px] text-muted-foreground">Wrote the first program.</p>
    </div>
  </div>
</DitherPreviewCard>`;

const COMMAND_ITEMS = [
  { value: "new-artboard", label: "New artboard", group: "Studio", kbd: "N" },
  { value: "export-image", label: "Export image", group: "Studio", kbd: "⇧E" },
  { value: "toggle-theme", label: "Toggle theme", group: "Settings" },
  { value: "open-settings", label: "Open settings", group: "Settings" },
];

const SNIPPET_COMMAND = `<DitherButton onClick={() => setOpen(true)}>⌘K · Command</DitherButton>
<DitherCommand
  open={open}
  items={[
    { value: 'new', label: 'New artboard', group: 'Studio', kbd: 'N' },
    { value: 'export', label: 'Export image', group: 'Studio' },
    { value: 'docs', label: 'Open docs', group: 'Navigate' },
  ]}
  onSelect={run}
  onClose={() => setOpen(false)}
/>
{/* the ⌘K hotkey stays in your hands — wire your own keydown listener */}`;

const SNIPPET_RADIAL = `<DitherRadialMenu
  items={[
    { label: 'Add', icon: '+' },
    { label: 'Edit', icon: '✎' },
    { label: 'Share', icon: '↗' },
    { label: 'Delete', icon: '×' },
  ]}
  radius={84}
  label="Actions"
  onSelect={(item) => run(item.label)}
/>
{/* press-and-hold (or click) fans the wedges; release over one selects */}`;

const SNIPPET_BOTTOMSHEET = `<DitherButton onClick={() => setOpen(true)}>Open sheet</DitherButton>
<DitherBottomSheet open={open} title="Filters" onClose={() => setOpen(false)}>
  <p>Sheet content slides up from the bottom edge.</p>
</DitherBottomSheet>
{/* bottom-only modal · true focus trap · drag-to-dismiss grabber · Escape closes */}`;

const BOTTOMSHEET_PROPS: PropRow[] = [
  { prop: "open", type: "boolean", default: "—" },
  { prop: "onClose", type: "() => void", default: "—" },
  { prop: "title", type: "string", default: "—" },
  { prop: "swipe", type: "boolean — drag to dismiss", default: "true" },
  { prop: "dismissible", type: "boolean — backdrop click", default: "true" },
  { prop: "color", type: "PixelColor — grabber", default: '"blue"' },
];

const SNIPPET_HOVERCARD = `<DitherHoverCard content="Rich detail on hover or focus." side="top">
  <button>Hover me</button>
</DitherHoverCard>
{/* hover/focus-triggered card · dithered pixel border · open/close delays ·
    side + align placement · focusable trigger recommended */}`;

const HOVERCARD_PROPS: PropRow[] = [
  { prop: "children", type: "ReactNode — trigger", default: "—" },
  { prop: "content", type: "ReactNode", default: "—" },
  { prop: "side", type: '"top" | "bottom"', default: '"top"' },
  { prop: "align", type: '"start" | "center" | "end"', default: '"center"' },
  { prop: "delay / closeDelay", type: "number (ms)", default: "—" },
  { prop: "gap", type: "number (px)", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const API: Record<string, PropRow[]> = {
  popover: [
    { prop: "open", type: "boolean", default: "—" },
    { prop: "align", type: '"start" | "center" | "end"', default: '"start"' },
  ],
  menu: [{ prop: "items", type: "MenuItem[]", default: "—" }],
  contextMenu: [{ prop: "items", type: "ContextMenuItem[]", default: "—" }],
  menubar: [
    {
      prop: "menus",
      type: "{ label: string; items: MenubarItem[] }[]",
      default: "—",
    },
  ],
  tooltip: [
    { prop: "text", type: "string", default: "—" },
    { prop: "delay", type: "number", default: "300" },
  ],
  previewCard: [{ prop: "delay", type: "number", default: "400" }],
  command: [
    { prop: "open", type: "boolean — onClose asks to leave", default: "required" },
    { prop: "items", type: "{ value, label, group?, kbd? }[]", default: "required" },
    { prop: "placeholder", type: "string", default: '"Type a command…"' },
    { prop: "empty", type: "string — no-match line", default: '"No results."' },
    { prop: "onSelect", type: "(value: string) — fired before close", default: "—" },
    { prop: "onClose", type: "() — asks to leave", default: "—" },
  ],
  radialMenu: [
    { prop: "items", type: "{ label, icon?, disabled? }[]", default: "required" },
    { prop: "radius", type: "number (px) — ring radius", default: "84" },
    { prop: "open", type: "boolean (controlled)", default: "internal" },
    { prop: "label", type: "string — accessible name", default: '"Menu"' },
    { prop: "onSelect", type: "(item, index) — on release/select", default: "—" },
  ],
};

const SNIPPET_TOUR = `<DitherTour open={open} steps={steps} onClose={() => setOpen(false)} />
{/* product-tour coach marks · dithered spotlight cutout + Bayer feather · focus
    trap + live region · Escape/Skip/Done all fire onClose */}`;

const TOUR_PROPS: PropRow[] = [
  { prop: "open", type: "boolean", default: "required" },
  { prop: "steps", type: "DitherTourStep[] — { target, title, body? }", default: "required" },
  { prop: "initialStep", type: "number", default: "0" },
  { prop: "spotlightPad / scrimAlpha", type: "number (px) / 0–1", default: "10 / 0.72" },
  { prop: "labels", type: "{ back?, next?, done?, skip? }", default: "—" },
  { prop: "onClose / onComplete / onStepChange", type: "() => void / (i) => void", default: "—" },
];

const SNIPPET_COMMANDQUEUE = `<DitherCommandQueue toasts={toasts} onDismiss={dismiss} position="top-right" />
{/* positioned card stack (not the imperative toast store) · split title/body ·
    semantic variant maps to a kit colour · optional action · duration:0 is sticky */}`;

const COMMANDQUEUE_PROPS: PropRow[] = [
  { prop: "toasts", type: "QueueToast[]", default: "required" },
  { prop: "onDismiss", type: "(id: number) => void", default: "required" },
  { prop: "position", type: '"top-right" | "top-left" | "bottom-right" | "bottom-left"', default: '"top-right"' },
];

export function OverlayDocs() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [menuAction, setMenuAction] = useState("none");
  const [ctxAction, setCtxAction] = useState("none");
  const [lastAction, setLastAction] = useState("none");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandRan, setCommandRan] = useState("—");
  const [tourOpen, setTourOpen] = useState(false);
  const [queueToasts, setQueueToasts] = useState<QueueToast[]>([]);

  return (
    <>
      {/* Popover */}
      <section id="popover" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Popover</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An anchored panel below its trigger — bring your own trigger and content.
          Escape or an outside press emits close.
        </p>
        <DemoCard code={SNIPPET_POPOVER}>
          <div className="flex justify-center">
            <DitherPopover
              open={popoverOpen}
              align="center"
              onClose={() => setPopoverOpen(false)}
              trigger={
                <DitherButton onClick={() => setPopoverOpen(!popoverOpen)}>
                  Open popover
                </DitherButton>
              }
            >
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Anchored to its trigger — Escape or an outside press closes it.
              </p>
            </DitherPopover>
          </div>
        </DemoCard>
        <PropsTable rows={API.popover} />
      </section>

      {/* Menu */}
      <section id="menu" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Menu</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A dropdown menu behind a single button — arrow keys move focus, Enter
          selects, Escape closes and refocuses the trigger.
        </p>
        <DemoCard code={SNIPPET_MENU}>
          <div className="flex flex-col items-center gap-3">
            <DitherMenu items={MENU_ITEMS} onSelect={(label) => setMenuAction(label)}>
              Actions
            </DitherMenu>
            <p className="text-[12px] text-muted-foreground">
              last action: {menuAction}
            </p>
          </div>
        </DemoCard>
        <PropsTable rows={API.menu} />
      </section>

      {/* Context Menu */}
      <section id="context-menu" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Context Menu</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A right-click menu teleported to the pointer — same items and keyboard
          behavior as Menu, dismissed by Escape or any outside press.
        </p>
        <DemoCard code={SNIPPET_CONTEXT}>
          <div className="flex flex-col items-center gap-3">
            <DitherContextMenu
              items={CTX_ITEMS}
              onSelect={(label) => setCtxAction(label)}
            >
              <div className="flex h-32 w-64 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground select-none">
                right-click me
              </div>
            </DitherContextMenu>
            <p className="text-[12px] text-muted-foreground">
              last action: {ctxAction}
            </p>
          </div>
        </DemoCard>
        <PropsTable rows={API.contextMenu} />
      </section>

      {/* Menubar */}
      <section id="menubar" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Menubar</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A desktop-style horizontal bar — one menu open at a time, hover switches
          between top items, ArrowLeft/Right move across them.
        </p>
        <DemoCard code={SNIPPET_MENUBAR}>
          <div className="flex flex-col items-center gap-3">
            <DitherMenubar
              menus={MENUBAR}
              onSelect={(menu, item) => setLastAction(`${menu} → ${item}`)}
            />
            <p className="text-[12px] text-muted-foreground">
              last action: {lastAction}
            </p>
          </div>
        </DemoCard>
        <PropsTable rows={API.menubar} />
      </section>

      {/* Tooltip */}
      <section id="tooltip" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tooltip</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A delayed hover tip above its target — also shows on focus, hides on
          leave, blur, or Escape. No transition under reduced motion.
        </p>
        <DemoCard code={SNIPPET_TOOLTIP}>
          <div className="flex justify-center">
            <DitherTooltip text="Deploys are frozen until Monday">
              <DitherBadge color="orange">frozen</DitherBadge>
            </DitherTooltip>
          </div>
        </DemoCard>
        <PropsTable rows={API.tooltip} />
      </section>

      {/* Preview Card */}
      <section id="preview-card" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Preview Card</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A hover preview for rich content — opens after a delay on hover or focus;
          a short close delay lets the pointer travel into the card.
        </p>
        <DemoCard code={SNIPPET_PREVIEW}>
          <div className="flex justify-center">
            <DitherPreviewCard
              trigger={
                <span
                  className="cursor-pointer text-[13px] underline decoration-border underline-offset-4"
                  tabIndex={0}
                >
                  @ada
                </span>
              }
            >
              <div className="flex items-center gap-3">
                <DitherAvatar name="Ada Lovelace" size={40} />
                <div>
                  <p className="text-[13px] text-foreground">Ada Lovelace</p>
                  <p className="text-[11px] text-muted-foreground">
                    Wrote the first program.
                  </p>
                </div>
              </div>
            </DitherPreviewCard>
          </div>
        </DemoCard>
        <PropsTable rows={API.previewCard} />
      </section>
      <section id="command" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Command</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The ⌘K palette — type to filter, arrows to walk, Enter runs, Escape leaves.
          Groups follow first appearance; the hotkey stays in your hands.
        </p>
        <DemoCard code={SNIPPET_COMMAND}>
          <div className="grid min-h-28 place-items-center gap-3">
            <DitherButton color="blue" className="px-3 py-1.5 text-[12px]" onClick={() => setCommandOpen(true)}>⌘K · Command</DitherButton>
            <p className="text-[10px] text-muted-foreground">last ran: {commandRan}</p>
            <DitherCommand
              open={commandOpen}
              items={COMMAND_ITEMS}
              onSelect={setCommandRan}
              onClose={() => setCommandOpen(false)}
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.command} />
      </section>

      <section id="radial-menu" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Radial menu</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A press-and-hold pie menu — pointer-down fans a ring of dithered wedges
          around the trigger, the wedge under the pointer highlights, and release
          selects. A quick click flips it into a sticky mode for hold-free use.
          Fully keyboard-operable (arrows walk, Enter selects, Escape closes).
        </p>
        <DemoCard code={SNIPPET_RADIAL}>
          <div className="grid min-h-56 place-items-center">
            <DitherRadialMenu
              items={[
                { label: "Add", icon: "+" },
                { label: "Edit", icon: "✎" },
                { label: "Share", icon: "↗" },
                { label: "Delete", icon: "×" },
              ]}
              radius={84}
              label="Actions"
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.radialMenu} />
      </section>

      {/* Bottom sheet */}
      <section id="bottom-sheet" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Bottom sheet</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A modal panel that slides up from the bottom edge — bottom-only, with a
          true focus trap and a drag-to-dismiss grabber whose affordance reads as a
          dithered capsule. Escape closes, the close button takes focus on open, and
          reduced motion snaps the dismiss.
        </p>
        <DemoCard code={SNIPPET_BOTTOMSHEET}>
          <div className="flex justify-center">
            <DitherButton onClick={() => setSheetOpen(true)}>Open bottom sheet</DitherButton>
            <DitherBottomSheet open={sheetOpen} title="Filters" onClose={() => setSheetOpen(false)} color="blue">
              <p className="text-[13px] text-muted-foreground">Sheet content slides up from the bottom edge.</p>
            </DitherBottomSheet>
          </div>
        </DemoCard>
        <PropsTable rows={BOTTOMSHEET_PROPS} />
      </section>

      {/* Hover card */}
      <section id="hover-card" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Hover card</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A hover- and focus-triggered card with a dithered pixel border. Pass a
          focusable trigger (button/link) so keyboard focus opens it; a non-focusable
          trigger falls back to a focusable wrapper. Open and close delays, plus side
          and align placement, are all configurable.
        </p>
        <DemoCard code={SNIPPET_HOVERCARD}>
          <div className="flex justify-center py-8">
            <DitherHoverCard content="Rich detail shown on hover or focus." side="top" align="center" color="blue">
              <DitherButton>Hover or focus me</DitherButton>
            </DitherHoverCard>
          </div>
        </DemoCard>
        <PropsTable rows={HOVERCARD_PROPS} />
      </section>

      {/* Tour */}
      <section id="tour" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tour</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Product-tour coach marks. Each step spotlights a target by CSS selector;
          the scrim carves a hole with a Bayer-feathered edge instead of clipping
          hard, a focus trap keeps the keyboard inside the coach mark, and a live
          region announces the step. Escape, Skip, Done, and a backdrop click all
          close the tour.
        </p>
        <DemoCard code={SNIPPET_TOUR}>
          <div className="mx-auto max-w-md text-center">
            <div className="flex items-center justify-center gap-3">
              <DitherButton onClick={() => setTourOpen(true)}>Start tour</DitherButton>
              <DitherBadge data-tour="0">beta</DitherBadge>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground" data-tour="1">
              The tour spotlights these two spots, then finishes.
            </p>
            <DitherTour
              open={tourOpen}
              onClose={() => setTourOpen(false)}
              steps={[
                { target: "[data-tour='0']", title: "Status badge", body: "Labels and release flags." },
                { target: "[data-tour='1']", title: "Caption", body: "Context lines for the reader." },
              ]}
            />
          </div>
        </DemoCard>
        <PropsTable rows={TOUR_PROPS} />
      </section>

      {/* Command queue */}
      <section id="command-queue" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Command queue</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A positioned notification card stack &mdash; a controlled component, not
          the imperative toast store. Each card carries a split title/body, a
          semantic variant that maps to a kit colour, an optional action, and an
          auto-dismiss timer (<code className="text-foreground/80">duration: 0</code>
          is sticky). The parent owns the{" "}
          <code className="text-foreground/80">toasts</code> array and dismisses by
          id.
        </p>
        <DemoCard code={SNIPPET_COMMANDQUEUE}>
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <button
              type="button"
              className="rounded border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setQueueToasts((t) => [...t, { id: Date.now(), title: "Ping", body: "spawned from the docs", variant: "info", duration: 0 }])}
            >
              notify
            </button>
            <p className="text-[10px] text-muted-foreground">cards anchor to the viewport corner</p>
          </div>
          <DitherCommandQueue toasts={queueToasts} onDismiss={(id) => setQueueToasts((t) => t.filter((x) => x.id !== id))} position="top-right" />
        </DemoCard>
        <PropsTable rows={COMMANDQUEUE_PROPS} />
      </section>

    </>
  );
}
