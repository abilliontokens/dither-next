"use client";

import { useState } from "react";

import {
  DitherButton,
  DitherCenterMorphModal,
  DitherCollapsible,
  DitherDialog,
  DitherFlow,
  DitherKanban,
  DitherKbd,
  DitherMasonry,
  DitherMiniMap,
  DitherOrgChart,
  DitherSplitPane,
  DitherTabPanel,
  DitherTabs,
  DitherTreeView,
  type DitherOrgNode,
  type TabItem,
  type TabsVariant,
  DitherVirtualList,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

const TABS = ["Overview", "Metrics", "Logs"];

const PANEL: Record<string, string> = {
  Overview: "Requests are steady; nothing on fire.",
  Metrics: "p95 latency 42ms, error rate 0.02%.",
  Logs: "3 warnings in the last hour, zero errors.",
};

const TAB_VARIANTS: TabsVariant[] = ["underline", "segmented", "washed"];

const VERT_TABS: TabItem[] = [
  { value: "Inbox", badge: 12 },
  { value: "Drafts", badge: 2 },
  { value: "Archive" },
  { value: "Spam", disabled: true },
];

const SNIPPET_TABS = `{/* panels nest inside so they inherit the tab context */}
<DitherTabs value={tab} onChange={setTab} tabs={['Overview', 'Metrics', 'Logs']}>
  <DitherTabPanel value="Overview" className="mt-4">…</DitherTabPanel>
  <DitherTabPanel value="Metrics" className="mt-4">…</DitherTabPanel>
  <DitherTabPanel value="Logs" className="mt-4">…</DitherTabPanel>
</DitherTabs>

{/* variant: underline | segmented | washed */}
<DitherTabs value={tab} onChange={setTab} tabs={tabs} variant="segmented" />

{/* objects add badges and disabled; vertical flips the rail */}
<DitherTabs value={folder} onChange={setFolder} orientation="vertical" variant="washed"
  tabs={[{ value: 'Inbox', badge: 12 }, { value: 'Spam', disabled: true }]} />`;

const SNIPPET_COLLAPSIBLE = `<DitherCollapsible value={openA} onChange={setOpenA} title="What is dithering?" color="blue">
  Ordered dithering trades smooth gradients for a fixed threshold
  matrix — the same Bayer 4x4 behind every fill in this kit.
</DitherCollapsible>
<DitherCollapsible value={openB} onChange={setOpenB} title="Why canvas?" color="purple">
  One engine paints every fill, so components stay coherent.
</DitherCollapsible>`;

const SNIPPET_DIALOG = `<DitherButton onClick={() => setOpen(true)}>Open dialog</DitherButton>
<DitherDialog open={open} title="Confirm"
  description="Ship the dithered build to production?" onClose={() => setOpen(false)}>
  <p className="text-[13px] text-muted-foreground">Review the release before continuing.</p>
  footer={
    <DitherButton color="green" onClick={() => setOpen(false)}>Confirm</DitherButton>
  }
</DitherDialog>`;

const SNIPPET_KBD = `<div className="flex items-center gap-6 text-xs">
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground">Command menu</span>
    <DitherKbd>⌘</DitherKbd>
    <DitherKbd>K</DitherKbd>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground">Shortcuts</span>
    <DitherKbd>?</DitherKbd>
  </div>
</div>`;

const SNIPPET_MORPH = `<DitherButton onClick={() => setOpen(true)}>Open modal</DitherButton>
<DitherCenterMorphModal open={open} label="Release notes" onClose={() => setOpen(false)}>
  <div className="flex h-full flex-col justify-end gap-2">
    <h3 className="text-sm font-medium text-foreground">v2.4 — dithered everything</h3>
    <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
      This full-size surface unfolded from its exact center. Press Escape,
      the backdrop, or the inset control to fold it back.
    </p>
  </div>
</DitherCenterMorphModal>`;

const TREE_NODES = [
  { id: "n0", label: "Components", children: [{ id: "n0-1", label: "Buttons" }, { id: "n0-2", label: "Backgrounds" }] },
  { id: "n1", label: "Charts", children: [{ id: "n1-1", label: "Area" }, { id: "n1-2", label: "Radar" }] },
  { id: "n2", label: "Backgrounds", children: [{ id: "n2-1", label: "Aurora" }] },
];

const KANBAN_COLUMNS = [
  { id: "c0", title: "Todo", cards: [{ id: "k1", title: "Design review" }, { id: "k2", title: "Wire frames" }] },
  { id: "c1", title: "Doing", cards: [{ id: "k3", title: "Port the gauge" }] },
  { id: "c2", title: "Done", cards: [{ id: "k4", title: "Heat calendar" }, { id: "k5", title: "Tag input" }] },
];

const SNIPPET_TREE = `<DitherTreeView
  nodes={nodes}
  expanded={expanded}
  onExpandedChange={setExpanded}
  selected={selected}
  onSelectedChange={setSelected}
  color="blue"
/>
{/* controlled expand/select · arrow-key walk · one Bayer ramp per guide rail */}`;

const SNIPPET_SPLIT = `<DitherSplitPane orientation="horizontal" color="blue">
  <Nav />
  <Detail />
</DitherSplitPane>
{/* role="separator" drag handle · arrows nudge · PageUp/Down jump · Enter resets */}`;

const SNIPPET_KANBAN = `<DitherKanban
  columns={columns}
  onChange={setColumns}
  keyOf={(c) => c.id}
  renderCard={(c) => c.title}
  color="green"
/>
{/* parent owns the board · pointer drag with edge rubber-band · full keyboard DnD */}`;

const SNIPPET_MINIMAP = `<DitherMiniMap target={scrollRef} color="green" />
{/* density strip of a scrollable element · drag the lens to scroll · falls
    back to the nearest scrollable ancestor, then the window */}`;

const SNIPPET_VIRTUALLIST = `<DitherVirtualList items={rows} itemHeight={36} height={260} renderItem={(r) => r.label} getKey={(r) => r.id} />
{/* windowed list · only visible rows + overscan mount · active row + scroll
    thumb wear the Bayer fill · fixed itemHeight required */}`;

const VIRTUALLIST_PROPS: PropRow[] = [
  { prop: "items", type: "T[]", default: "required" },
  { prop: "itemHeight", type: "number (px)", default: "required" },
  { prop: "renderItem", type: "(item: T, index) => ReactNode", default: "required" },
  { prop: "height", type: "number (px)", default: "—" },
  { prop: "overscan", type: "number — extra rows", default: "—" },
  { prop: "getKey", type: "(item: T, index) => string | number", default: "—" },
  { prop: "color", type: "PixelColor", default: '"blue"' },
];

const API: Record<string, PropRow[]> = {
  tabs: [
    { prop: "tabs", type: "(string | { value, label?, badge?, disabled? })[]", default: "—" },
    { prop: "value", type: "string", default: "—" },
    { prop: "variant", type: '"underline" | "segmented" | "washed"', default: '"underline"' },
    { prop: "orientation", type: '"horizontal" | "vertical"', default: '"horizontal"' },
    { prop: "color", type: "PixelColor", default: '"blue"' },
    { prop: "value (TabPanel)", type: "string — nests inside DitherTabs", default: "—" },
  ],
  collapsible: [
    { prop: "title", type: "string", default: "—" },
    { prop: "value", type: "boolean", default: "false" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
  ],
  dialog: [
    { prop: "open", type: "boolean", default: "—" },
    { prop: "title", type: "string", default: "undefined" },
    { prop: "description", type: "string", default: "undefined" },
    { prop: "closeOnBackdrop", type: "boolean", default: "true" },
    { prop: "className", type: "string", default: "—" },
  ],
  kbd: [{ prop: "className", type: "string", default: "undefined" }],
  centerMorphModal: [
    { prop: "open", type: "boolean", default: "—" },
    { prop: "label", type: "string — accessible name", default: '"Modal"' },
    { prop: "closeOnBackdrop", type: "boolean", default: "true" },
    { prop: "onClose", type: "() — asks to leave", default: "—" },
    { prop: "children", type: "modal content", default: "—" },
  ],
  treeView: [
    { prop: "nodes", type: "TreeViewNode[] ({ id, label, children? })", default: "required" },
    { prop: "expanded", type: "string[] (controlled)", default: "required" },
    { prop: "selected", type: "string | null (controlled)", default: "required" },
    { prop: "color", type: "PixelColor — guide rail tint", default: '"blue"' },
    { prop: "seed", type: "number", default: "undefined" },
  ],
  splitPane: [
    { prop: "orientation", type: '"horizontal" | "vertical"', default: '"horizontal"' },
    { prop: "ratio", type: "number (0..1) — first pane fraction", default: "uncontrolled" },
    { prop: "min / max", type: "number — first-pane percent bounds", default: "— / —" },
    { prop: "color", type: "PixelColor — gripper", default: '"blue"' },
    { prop: "children", type: "exactly two panes", default: "—" },
  ],
  kanban: [
    { prop: "columns", type: "KanbanColumn<T>[] ({ id, title, cards })", default: "required" },
    { prop: "onChange", type: "(columns) — every move", default: "required" },
    { prop: "keyOf", type: "(card: T) => string", default: "required" },
    { prop: "renderCard", type: "(card: T) => ReactNode", default: "required" },
    { prop: "color", type: "PixelColor", default: '"blue"' },
  ],
  miniMap: [
    { prop: "target", type: "RefObject<HTMLElement> — omit for nearest scroller", default: "auto" },
    { prop: "orientation", type: '"vertical" | "horizontal"', default: '"vertical"' },
    { prop: "color", type: "PixelColor — lens tint", default: '"blue"' },
  ],
};

const SNIPPET_FLOW = `<DitherFlow nodes={nodes} edges={edges} onChange={setNodes} color="blue" />
{/* node-graph canvas · pointer-draggable DOM cards · dithered bezier edges ·
    pan/zoom always on · keyboard nudge when readonly is off */}`;

const FLOW_PROPS: PropRow[] = [
  { prop: "nodes", type: "DitherFlowNode[] — { id, x, y, label }", default: "required" },
  { prop: "edges", type: "DitherFlowEdge[] — { id, from, to }", default: "required" },
  { prop: "onChange", type: "(nodes: DitherFlowNode[]) => void", default: "—" },
  { prop: "selectedId / onSelectedChange", type: "string | null", default: "—" },
  { prop: "readonly", type: "boolean — disable node drag", default: "false" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const FLOW_NODES = [
  { id: "n0", label: "Input", x: 24, y: 36 },
  { id: "n1", label: "Process", x: 150, y: 18 },
  { id: "n2", label: "Filter", x: 150, y: 96 },
  { id: "n3", label: "Output", x: 276, y: 60 },
];
const FLOW_EDGES = [
  { id: "e0", from: "n0", to: "n1" },
  { id: "e1", from: "n0", to: "n2" },
  { id: "e2", from: "n1", to: "n3" },
  { id: "e3", from: "n2", to: "n3" },
];

const SNIPPET_MASONRY = `<DitherMasonry columns={3} gap={12} color="blue">{cards}</DitherMasonry>
{/* measured masonry/waterfall · children sized by content · staggered Bayer-veil
    reveal on first layout · column count or Tailwind-style breakpoint map */}`;

const MASONRY_PROPS: PropRow[] = [
  { prop: "children", type: "ReactNode — the items", default: "required" },
  { prop: "columns", type: "number | { base?, sm?, md?, lg?, xl? }", default: "3" },
  { prop: "gap", type: "number (px)", default: "12" },
  { prop: "stagger", type: "boolean — dither-veil reveal", default: "true" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

const ORG_NODES: DitherOrgNode[] = [
  { id: "n0", label: "CEO" },
  { id: "n1", label: "VP Engineering", parentId: "n0" },
  { id: "n2", label: "VP Design", parentId: "n0" },
  { id: "n3", label: "Eng Lead", parentId: "n1" },
  { id: "n4", label: "Design Lead", parentId: "n2" },
  { id: "n5", label: "Senior Engineer", parentId: "n3" },
];

const SNIPPET_ORGCHART = `<DitherOrgChart nodes={nodes} color="blue" />
{/* tidy-tree (Reingold–Tilford) layout · edges are dithered bezier strokes · arrow
    keys traverse depth-first · focusId drives the active node */}`;

const ORGCHART_PROPS: PropRow[] = [
  { prop: "nodes", type: "DitherOrgNode[]", default: "required" },
  { prop: "focusId", type: "string | null — controlled", default: "—" },
  { prop: "onFocusChange", type: "(id: string | null) => void", default: "—" },
  { prop: "color / seed", type: "PixelColor / number", default: '"blue" / —' },
];

export function StructureDocs() {
  const [treeExpanded, setTreeExpanded] = useState<string[]>(["n0", "n1", "n2"]);
  const [treeSelected, setTreeSelected] = useState<string | null>("n0");
  const [kanbanColumns, setKanbanColumns] = useState(KANBAN_COLUMNS);
  const [tab, setTab] = useState("Overview");
  const [variantTab, setVariantTab] = useState("Overview");
  const [vertTab, setVertTab] = useState("Inbox");
  const [openA, setOpenA] = useState(true);
  const [openB, setOpenB] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [morphOpen, setMorphOpen] = useState(false);

  return (
    <>
      <section id="tabs" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tabs</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A roving-tabindex tablist with a dithered underline that slides to the
          active tab. Arrow keys move selection.
        </p>
        <DemoCard code={SNIPPET_TABS}>
          <div className="mx-auto max-w-sm">
            <DitherTabs value={tab} onChange={setTab} tabs={TABS} color="blue">
              {TABS.map((t) => (
                <DitherTabPanel key={t} value={t} className="mt-4">
                  <p className="text-[12px] text-muted-foreground">{PANEL[t]}</p>
                </DitherTabPanel>
              ))}
            </DitherTabs>
          </div>
        </DemoCard>
        <h3 className="mt-8 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">variants</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {TAB_VARIANTS.map((v) => (
            <div key={v}>
              <div className="flex h-16 items-start justify-center rounded-lg border border-border/60 p-3">
                <DitherTabs value={variantTab} onChange={setVariantTab} tabs={TABS} variant={v} color="purple" />
              </div>
              <div className="mt-2 text-center text-[10px] text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>
        <h3 className="mt-8 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">vertical · badges · disabled</h3>
        <div className="mt-4 rounded-lg border border-border/60 p-4">
          <DitherTabs
            value={vertTab}
            onChange={setVertTab}
            tabs={VERT_TABS}
            orientation="vertical"
            variant="washed"
            color="green"
            className="mx-auto max-w-sm"
          >
            {VERT_TABS.map((t) => (
              <DitherTabPanel
                key={t.value}
                value={t.value}
                className="min-w-0 flex-1 self-stretch rounded-md border border-border/40 p-3"
              >
                <p className="text-[12px] text-muted-foreground">
                  {t.value} — {t.badge ?? 0} items.
                </p>
              </DitherTabPanel>
            ))}
          </DitherTabs>
        </div>
        <PropsTable rows={API.tabs} />
      </section>

      <section id="collapsible" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Collapsible</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A disclosure row animated through grid-template-rows; when open, a 2px
          dithered rail runs down the left edge of the content.
        </p>
        <DemoCard code={SNIPPET_COLLAPSIBLE}>
          <div className="mx-auto max-w-sm divide-y divide-border/60">
            <DitherCollapsible value={openA} onChange={setOpenA} title="What is dithering?" color="blue">
              Ordered dithering trades smooth gradients for a fixed threshold
              matrix — the same Bayer 4x4 behind every fill in this kit.
            </DitherCollapsible>
            <DitherCollapsible value={openB} onChange={setOpenB} title="Why canvas?" color="purple">
              One engine paints every fill, so components stay coherent.
            </DitherCollapsible>
          </div>
        </DemoCard>
        <PropsTable rows={API.collapsible} />
      </section>

      <section id="dialog" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Dialog</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A teleported modal with labelled title and description, trapped focus,
          Escape/backdrop dismissal, focus restoration, and an optional action footer.
        </p>
        <DemoCard code={SNIPPET_DIALOG}>
          <div className="flex justify-center">
            <DitherButton onClick={() => setDialogOpen(true)}>Open dialog</DitherButton>
            <DitherDialog
              open={dialogOpen}
              title="Confirm"
              description="Ship the dithered build to production?"
              onClose={() => setDialogOpen(false)}
              footer={
                <DitherButton color="green" onClick={() => setDialogOpen(false)}>
                  Confirm
                </DitherButton>
              }
            >
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Review the release before continuing.
              </p>
            </DitherDialog>
          </div>
        </DemoCard>
        <PropsTable rows={API.dialog} />
      </section>

      <section id="center-morph-modal" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Center Morph Modal</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A composable modal whose full-size surface unfolds from its exact center toward
          every edge, then folds back the same way with an inset close control. Same focus
          trap, Escape, and backdrop contract as Dialog.
        </p>
        <DemoCard code={SNIPPET_MORPH}>
          <div className="flex justify-center">
            <DitherButton onClick={() => setMorphOpen(true)}>Open modal</DitherButton>
            <DitherCenterMorphModal open={morphOpen} label="Release notes" onClose={() => setMorphOpen(false)}>
              <div className="flex h-full flex-col justify-end gap-2">
                <h3 className="text-sm font-medium text-foreground">v2.4 — dithered everything</h3>
                <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
                  This full-size surface unfolded from its exact center. Press Escape, the
                  backdrop, or the inset control to fold it back.
                </p>
              </div>
            </DitherCenterMorphModal>
          </div>
        </DemoCard>
        <PropsTable rows={API.centerMorphModal} />
      </section>

      <section id="kbd" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Kbd</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An honest keyboard key — no canvas, just the house border and a 2px
          bottom edge. Pairs with shortcut listings.
        </p>
        <DemoCard code={SNIPPET_KBD}>
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Command menu</span>
              <span className="flex items-center gap-1">
                <DitherKbd>⌘</DitherKbd>
                <DitherKbd>K</DitherKbd>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Shortcuts</span>
              <DitherKbd>?</DitherKbd>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.kbd} />
      </section>
      <section id="tree-view" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Tree view</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A file-tree-style outline — one Bayer ramp per guide rail, fading with depth
          so the eye lands on the top-level spine. Expand/select are controlled; full
          keyboard support (arrows walk, Enter toggles, Home/End jump).
        </p>
        <DemoCard code={SNIPPET_TREE}>
          <div className="mx-auto max-w-sm">
            <DitherTreeView nodes={TREE_NODES} expanded={treeExpanded} onExpandedChange={setTreeExpanded} selected={treeSelected} onSelectedChange={setTreeSelected} color="blue" />
          </div>
        </DemoCard>
        <PropsTable rows={API.treeView} />
      </section>

      <section id="split-pane" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Split pane</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A two-pane resizable split — the drag handle is a dithered gripper pad that
          brightens while active. Controlled when ratio is given; otherwise defaultRatio
          seeds uncontrolled state. Keyboard arrows nudge, PageUp/Down jump, Enter
          resets.
        </p>
        <DemoCard code={SNIPPET_SPLIT}>
          <DitherSplitPane orientation="horizontal" color="blue" className="h-48">
            <div className="grid h-full place-items-center rounded-l-lg border border-border/60 bg-card text-sm text-muted-foreground">Nav</div>
            <div className="grid h-full place-items-center rounded-r-lg border border-border/60 bg-card text-sm text-muted-foreground">Detail</div>
          </DitherSplitPane>
        </DemoCard>
        <PropsTable rows={API.splitPane} />
      </section>

      <section id="kanban" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Kanban</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A drag-and-drop board — pointer drag with edge rubber-band, a floating preview
          card, and full keyboard DnD. The parent owns the board: every move fires
          onChange with the new column set, so state lives where it belongs.
        </p>
        <DemoCard code={SNIPPET_KANBAN}>
          <DitherKanban columns={kanbanColumns} onChange={setKanbanColumns} keyOf={(c) => c.id} renderCard={(c) => c.title} color="green" />
        </DemoCard>
        <PropsTable rows={API.kanban} />
      </section>

      <section id="mini-map" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Mini map</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A document minimap — a compressed dithered density strip of a scrollable
          element with a draggable viewport lens. The natural companion to the scroll
          progress bar: this one is a real overview. Resolves the target from a ref, the
          nearest scrollable ancestor, or the window.
        </p>
        <DemoCard code={SNIPPET_MINIMAP}>
          <div className="mx-auto flex max-w-sm justify-center">
            <DitherMiniMap color="green" orientation="vertical" className="h-56" />
          </div>
        </DemoCard>
        <PropsTable rows={API.miniMap} />
      </section>

      {/* Virtual list */}
      <section id="virtual-list" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Virtual list</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A windowed list — only the visible rows plus an overscan mount, so
          thousands of items render smoothly. The active row and the scroll thumb
          wear the kit&apos;s Bayer fill. A fixed itemHeight is required; pass a getKey
          for stable keyed rendering.
        </p>
        <DemoCard code={SNIPPET_VIRTUALLIST}>
          <div className="mx-auto max-w-sm">
            <DitherVirtualList
              items={["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa"]}
              itemHeight={36}
              height={260}
              overscan={4}
              renderItem={(label) => <span className="text-[12px]">{label}</span>}
              getKey={(label, i) => `${label}-${i}`}
              color="blue"
            />
          </div>
        </DemoCard>
        <PropsTable rows={VIRTUALLIST_PROPS} />
      </section>


      {/* Flow */}
      <section id="flow" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Flow</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A node-graph canvas. Nodes are pointer-draggable DOM cards; edges are
          dithered bezier strokes stamped along a densely sampled curve, so the
          connector reads with the kit&apos;s ordered-dither texture. Pan and zoom
          always work; arrow keys nudge the selected node when readonly is off. The
          parent owns the graph &mdash; every drag fires onChange with the next
          nodes array.
        </p>
        <DemoCard code={SNIPPET_FLOW}>
          <div className="mx-auto max-w-2xl">
            <DitherFlow nodes={FLOW_NODES} edges={FLOW_EDGES} color="blue" className="h-56" />
          </div>
        </DemoCard>
        <PropsTable rows={FLOW_PROPS} />
      </section>

      {/* Masonry */}
      <section id="masonry" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Masonry</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A measured masonry/waterfall layout. Children are measured after mount
          and distributed across the shortest column, so items of any height pack
          without gaps. The first layout optionally staggers a Bayer-veil reveal,
          and the column count is a fixed number or a Tailwind-style breakpoint
          map checked widest-first.
        </p>
        <DemoCard code={SNIPPET_MASONRY}>
          <div className="mx-auto max-w-2xl">
            <DitherMasonry columns={3} gap={12} color="blue">
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 64 }}>Alpha</div>
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 104 }}>Beta</div>
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 80 }}>Gamma</div>
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 96 }}>Delta</div>
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 72 }}>Epsilon</div>
              <div className="rounded-lg border border-border/60 bg-card p-3 text-[11px] font-mono text-muted-foreground" style={{ minHeight: 112 }}>Zeta</div>
            </DitherMasonry>
          </div>
        </DemoCard>
        <PropsTable rows={MASONRY_PROPS} />
      </section>

      {/* Org chart */}
      <section id="org-chart" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Org chart</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A hierarchical org or dependency tree laid out with a tidy-tree
          (Reingold&ndash;Tilford) pass: leaves claim a horizontal unit, parents
          centre over their children. Edges are dithered bezier strokes stamped along
          a densely sampled curve, so the connectors read with the kit&apos;s
          ordered-dither texture. Arrow keys traverse the tree depth-first, and{" "}
          <code className="text-foreground/80">focusId</code> drives the active node.
        </p>
        <DemoCard code={SNIPPET_ORGCHART}>
          <div className="mx-auto max-w-2xl">
            <DitherOrgChart nodes={ORG_NODES} color="blue" className="h-64" />
          </div>
        </DemoCard>
        <PropsTable rows={ORGCHART_PROPS} />
      </section>

    </>
  );
}
