"use client";

import { useMemo, useState } from "react";

import {
  DitherAvatar,
  DitherButton,
  DitherCheckbox,
  DitherDrawer,
  DitherInput,
  DitherMenu,
  DitherMeter,
  DitherSidebar,
  DitherSidebarGroup,
  DitherSidebarItem,
  DitherSidebarSub,
  DitherSlider,
  DitherTooltip,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";

/**
 * SidebarExamples — the 12 sidebar application patterns.
 * Port of `src/pages/docs/examples/SidebarExamples.vue`.
 *
 * One React component rendering a fragment of 12 sections, matching the Vue
 * `<template>` (itself a fragment). Section ids, classes, prose, and the
 * SNIPPET_* code strings are ported from the Vue source; each SNIPPET shows
 * React/TSX usage of the kit (className, value/onValueChange/onChange/onSelect)
 * so the code tab documents the React API the demo renders.
 *
 * State mapping (guide §4): `ref` → `useState`; `reactive<Record>` →
 * `useState` record updated immutably (spread + keyed override); `reactive`
 * arrays → `useState` array with `.map` updates; `computed` → `useMemo`;
 * `v-model="collapsed"` on DitherSidebar → `value` + `onValueChange`;
 * `v-model` on DitherSidebarSub → `value` + `onValueChange`; `v-model` on
 * DitherCheckbox → `value` + `onChange`; `v-model="price"` on DitherSlider →
 * `value` + `onChange`; `@select` on DitherSidebarItem → `onSelect`; DitherMenu
 * `@select="switchTeam"` → `onSelect={switchTeam}` (label string); template
 * `#header`/`#footer` slots → `header`/`footer` props. `v-for="(x, name) in
 * RECORD"` → `Object.entries(RECORD).map(...)`.
 */

/* --- calendar (shared by personal + right-side) --- */
const CAL_LEAD = 2; // month opens on a Wednesday
const CAL_DAYS = 31;
const CAL_TODAY = 21;
const calCells = Array.from({ length: CAL_LEAD + CAL_DAYS }, (_, i) =>
  i < CAL_LEAD ? null : i - CAL_LEAD + 1,
);
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* --- e-commerce filters data --- */
const CAT_COUNTS: Record<string, number> = { Prints: 125, Frames: 89, Zines: 34, Stickers: 67 };
const BRAND_COUNTS: Record<string, number> = { "Bayer & Co": 45, Ordered: 38, Halftone: 29 };

/* --- documentation tree --- */
const DOCS_TREE: Record<string, string[]> = {
  "Getting started": ["Introduction", "Installation", "Quick start", "Configuration"],
  "API reference": ["Props", "Events", "Slots"],
  Guides: ["Theming", "Composition"],
};

/* --- dual layout panels --- */
type PanelItem = { label: string; badge?: number };
const PANELS: Record<string, { title: string; items: PanelItem[] }> = {
  Inbox: { title: "Inbox", items: [{ label: "All mail", badge: 24 }, { label: "Starred", badge: 3 }, { label: "Drafts" }, { label: "Archive" }] },
  Files: { title: "Files", items: [{ label: "Recent" }, { label: "Shared with me", badge: 5 }, { label: "Exports" }, { label: "Trash" }] },
  Tasks: { title: "Tasks", items: [{ label: "Today", badge: 4 }, { label: "Upcoming", badge: 12 }, { label: "Someday" }, { label: "Done" }] },
};

/* --- floating favorites --- */
const FAVORITES = [
  "Print run planning & schedule",
  "Zine layouts & paste-ups",
  "Palette research notebook",
  "Client proofs & feedback",
];

/* --- team switcher data --- */
type TeamColor = "blue" | "green" | "purple";
type Team = { color: TeamColor; plan: string; groups: Record<string, PanelItem[]> };
const TEAMS: Record<string, Team> = {
  "Acme Inc": {
    color: "blue",
    plan: "Enterprise",
    groups: {
      Product: [{ label: "Roadmap" }, { label: "Releases", badge: 3 }, { label: "Feedback" }],
      Ops: [{ label: "Billing" }, { label: "Members", badge: 24 }],
    },
  },
  "Pixel Labs": {
    color: "purple",
    plan: "Startup",
    groups: {
      Research: [{ label: "Experiments", badge: 7 }, { label: "Datasets" }, { label: "Notebooks" }],
      Studio: [{ label: "Prototypes" }, { label: "Reviews", badge: 2 }],
    },
  },
  "Zine Press": {
    color: "green",
    plan: "Indie",
    groups: {
      Issues: [{ label: "Drafts", badge: 4 }, { label: "Published" }],
      Shop: [{ label: "Orders", badge: 12 }, { label: "Stock" }],
    },
  },
};
const teamNames = Object.keys(TEAMS);

/* --- icon rail items --- */
type RailColor = "blue" | "purple" | "green" | "red";
const RAIL_ITEMS: { label: string; badge?: number; color: RailColor }[] = [
  { label: "Charts", badge: undefined, color: "blue" },
  { label: "Palettes", badge: 2, color: "purple" },
  { label: "Exports", badge: undefined, color: "green" },
  { label: "Alerts", badge: 5, color: "red" },
];

/* --- dashboard stats + admin skeleton widths --- */
const DASH_STATS: [string, string][] = [
  ["Revenue", "$12,480"],
  ["Active", "1,204"],
  ["Churn", "0.8%"],
];
const ADMIN_WIDTHS = ["w-1/3", "w-1/4", "w-2/5", "w-1/3", "w-1/5"];

const SNIPPET_DASHBOARD = `<div className="flex h-96 overflow-hidden rounded-lg border">
  <DitherSidebar value={collapsed} onValueChange={setCollapsed}
    variant="washed" washColor="blue" toggle={false}>
    <div slot="header">…wordmark…</div>
    <DitherSidebarGroup label="Main">
      <DitherSidebarItem label="Dashboard" active={active === 'Dashboard'} />
      <DitherSidebarItem label="Projects" badge={12} />
      <DitherSidebarItem label="Team" />
      <DitherSidebarItem label="Settings" />
    </DitherSidebarGroup>
    <div slot="footer">
      <div className="rounded-md border p-2.5">   {/* upgrade card */}
        Upgrade to pro
        <DitherButton color="blue" className="w-full">Upgrade</DitherButton>
      </div>
      …user row…
    </div>
  </DitherSidebar>
  <main className="flex-1">
    <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar" />
    <nav aria-label="Breadcrumb">Home / Projects / {active}</nav>
    …content…
  </main>
</div>`;

const SNIPPET_ADMIN = `<DitherSidebar value={hidden} onValueChange={setHidden}
  collapse="hide" variant="floating" toggle={false}>
  <DitherSidebarGroup label="Manage">
    <DitherSidebarItem label="Members" badge={24} />
    <DitherSidebarItem label="Roles" />
    <DitherSidebarItem label="Audit log" badge="!" color="red" />
  </DitherSidebarGroup>
  <DitherSidebarGroup label="Quick actions">
    <DitherSidebarItem label="New member" />
    <DitherSidebarItem label="Create invite" />
  </DitherSidebarGroup>
  <div slot="footer">
    <div className="rounded-md border p-2.5">    {/* storage card */}
      Storage <DitherMeter value={68} /> 6.8 of 10 GB
    </div>
    <DitherAvatar name="Rei Toma" size={22} />  {/* profile row */}
    <button aria-label="Sign out">…</button>
  </div>
</DitherSidebar>
<main><button onClick={() => setHidden(!hidden)}>☰</button> …table…</main>`;

const SNIPPET_FILTERS = `<DitherSidebar collapse="none" variant="inset">
  <div slot="header">…store name + tagline…</div>
  <DitherInput value={search} onChange={setSearch} placeholder="Search products…" />

  <DitherSidebarGroup label="Categories">
    {Object.keys(categories).map(c => (
      <label key={c}>
        <DitherCheckbox value={checked[c]}
          onChange={() => toggle(c)}>{c}</DitherCheckbox>
        <span>({counts[c]})</span>
      </label>
    ))}
  </DitherSidebarGroup>

  <DitherSidebarGroup label="Price">
    <DitherSlider value={price} min={0} max={500} label="Price" />
    <span>\${price[0]} — \${price[1]}</span>
  </DitherSidebarGroup>

  <div slot="footer">
    <DitherButton color="green" className="w-full">Apply filters</DitherButton>
    <button onClick={reset}>Reset all</button>
  </div>
</DitherSidebar>`;

const SNIPPET_DOCS = `<DitherSidebar collapse="none" density="compact" variant="inset">
  <div slot="header">
    …project + v2.4 chip…
    <DitherInput value={query} onChange={setQuery} placeholder="Search docs…" />  {/* filters the tree */}
  </div>

  {/* searching forces groups open and prunes rows */}
  {Object.entries(filtered).map(([group, items]) => (
    <DitherSidebarSub key={group} label={group}
      value={query.trim() ? true : open[group]}
      onValueChange={v => setOpen({ ...open, [group]: v })}>
      {items.map(item => (
        <DitherSidebarItem key={item} label={item}
          active={active === item} onSelect={() => setActive(item)} />
      ))}
    </DitherSidebarSub>
  ))}
  {!Object.keys(filtered).length && <p>No pages match.</p>}

  <div slot="footer">
    <div className="rounded-md border p-2.5">Need help? …</div>
  </div>
</DitherSidebar>`;

const SNIPPET_DUAL = `{/* tier 1: permanent icon rail · tier 2: contextual panel */}
<DitherSidebar collapse="rail" value={true} toggle={false} className="w-14">
  {Object.keys(panels).map(p => (
    <DitherSidebarItem key={p} label={p}
      active={rail === p} onSelect={() => setRail(p)} />
  ))}
</DitherSidebar>

<DitherSidebar collapse="none" variant="inset" className="border-r">
  <div slot="header">{rail}</div>
  {panelItems[rail].map(item => (
    <DitherSidebarItem key={item.label} label={item.label} badge={item.badge}
      active={active === item.label} onSelect={() => setActive(item.label)} />
  ))}
</DitherSidebar>

<main>…{rail} / {active}…</main>`;

const SNIPPET_PERSONAL = `<DitherSidebar collapse="none" variant="inset">
  <div slot="header">
    <DitherAvatar name="Mika" size={26} color="purple" />
    Personal hub — organize your day
  </div>

  <DitherSidebarGroup label="Calendar">
    <div className="grid grid-cols-7 gap-0.5 text-center">
      {dow.map(d => <span key={d}>{d}</span>)}
      {cells.map((day, i) => (
        <span key={i} className={day === today ? 'bg-card ring-1' : ''}>
          {day}
        </span>
      ))}
    </div>
  </DitherSidebarGroup>

  <DitherSidebarGroup label="Personal">
    {personal.map((t, i) => (
      <label key={i}>
        <DitherCheckbox value={t.done} color="purple"
          onChange={() => toggle(i)}>
          <span className={t.done ? 'line-through opacity-60' : ''}>{t.label}</span>
        </DitherCheckbox>
      </label>
    ))}
  </DitherSidebarGroup>

  <DitherSidebarGroup label="Work">…same shape…</DitherSidebarGroup>
  <div slot="footer">All synced</div>
</DitherSidebar>`;

const SNIPPET_FLOATING = `<div className="relative h-96 rounded-lg border bg-card/20 p-2">
  <DitherSidebar value={collapsed} onValueChange={setCollapsed}
    variant="floating" className="m-0 h-full">
    <div slot="header">                {/* workspace switcher */}
      <button className="flex w-full items-center gap-2 rounded-md border p-1.5">
        <DitherAvatar name="acme" size={22} />
        {!collapsed && 'Acme Inc — enterprise'}
        <span aria-hidden="true">⇅</span>
      </button>
      {!collapsed && <DitherInput placeholder="Search…" />}
    </div>
    <DitherSidebarItem label="Assistant" color="purple" />
    <DitherSidebarItem label="Home" active={active === 'Home'} />
    <DitherSidebarItem label="Inbox" badge={10} />
    <DitherSidebarGroup label="Favorites">
      {favorites.map(f => <DitherSidebarItem key={f} label={f} />)}  {/* truncates */}
    </DitherSidebarGroup>
    <div slot="footer">…user row…</div>
  </DitherSidebar>
</div>`;

const SNIPPET_RIGHT = `<div className="flex h-96 overflow-hidden rounded-lg border">
  <main className="flex-1">
    <button aria-label="Toggle panel" onClick={() => setCollapsed(!collapsed)}>☰</button>
    …content…
  </main>

  <DitherSidebar value={collapsed} onValueChange={setCollapsed}
    side="right" collapse="hide" toggle={false}>
    <div slot="header">
      <DitherAvatar name="Juno Bit" size={24} />
      Juno Bit — juno@dither-ui.com
    </div>

    <DitherSidebarGroup label="Calendar">…mini month grid…</DitherSidebarGroup>

    <DitherSidebarGroup label="My calendars">
      {calendars.map((c, i) => (
        <label key={c.label} className="flex items-center gap-2">
          <DitherCheckbox value={c.on} color={c.color}
            onChange={() => toggle(i)}>{c.label}</DitherCheckbox>
          <span className="ml-auto size-1.5 rounded-full" style={{ background: c.color }} />
        </label>
      ))}
    </DitherSidebarGroup>

    <div slot="footer"><button>+ New calendar</button></div>
  </DitherSidebar>
</div>`;

const SNIPPET_TEAMS = `<DitherSidebar variant="washed" washColor={teams[team].color}>
  <div slot="header">              {/* workspace dropdown really switches */}
    <DitherMenu items={names.map(n => ({ label: n }))} onSelect={switchTeam}>
      <span className="flex items-center gap-2">
        <DitherAvatar name={team} size={22} color={teams[team].color} />
        {team} — {teams[team].plan} <span aria-hidden="true">⇅</span>
      </span>
    </DitherMenu>
  </div>
  {Object.entries(teams[team].groups).map(([group, items]) => (
    <DitherSidebarGroup key={group} label={group}>
      {items.map(i => (
        <DitherSidebarItem key={i.label} label={i.label} badge={i.badge}
          color={teams[team].color}
          active={active === i.label} onSelect={() => setActive(i.label)} />
      ))}
    </DitherSidebarGroup>
  ))}
</DitherSidebar>`;

const SNIPPET_TREE = `<DitherSidebar collapse="none" density="compact" variant="inset">
  <div slot="header">
    Explorer · <button onClick={() => all(true)}>expand</button>
    / <button onClick={() => all(false)}>collapse</button>
  </div>

  <DitherSidebarSub value={open.src} onValueChange={v => setOpen(o => ({ ...o, src: v }))} label="src">
    <DitherSidebarSub value={open.components} label="components">   {/* nests */}
      <DitherSidebarItem label="DitherSidebar.vue"
        active={file === 'DitherSidebar.vue'} onSelect={() => setFile('DitherSidebar.vue')} />
      <DitherSidebarItem label="DitherButton.vue" />
    </DitherSidebarSub>
    <DitherSidebarSub value={open.charts} label="charts">…</DitherSidebarSub>
    <DitherSidebarItem label="index.ts" />
  </DitherSidebarSub>
  <DitherSidebarSub value={open.public} label="public">…</DitherSidebarSub>
</DitherSidebar>`;

const SNIPPET_DRAWER = `{/* mobile: the sidebar rides in a drawer */}
<button aria-label="Open navigation" onClick={() => setOpen(true)}>☰</button>

<DitherDrawer open={open} side="left" title="Navigation" onClose={() => setOpen(false)}>
  <DitherSidebarGroup label="Browse">   {/* items work standalone */}
    {items.map(i => (
      <DitherSidebarItem key={i} label={i}
        active={active === i} onSelect={() => pick(i)} />  {/* pick() also closes */}
    ))}
  </DitherSidebarGroup>
  <DitherSidebarGroup label="Library">…</DitherSidebarGroup>
</DitherDrawer>

{/* swipe-to-dismiss ships with the drawer; Escape closes; focus is trapped */}`;

const SNIPPET_RAIL = `{/* the whole nav in 56px — tooltips carry the labels */}
<DitherSidebar collapse="rail" value={true} toggle={false}>
  <div slot="header">…glyph…</div>
  {items.map(i => (
    <DitherTooltip key={i.label} text={i.label}>
      <DitherSidebarItem label={i.label} badge={i.badge} color={i.color}
        active={active === i.label} onSelect={() => setActive(i.label)} />
    </DitherTooltip>
  ))}
  <div slot="footer"><DitherAvatar name="Ada Byte" size={22} /></div>
</DitherSidebar>`;

export function SidebarExamples() {
  /* Basic dashboard */
  const [dashCollapsed, setDashCollapsed] = useState(false);
  const [dashActive, setDashActive] = useState("Dashboard");

  /* Admin with profile */
  const [adminHidden, setAdminHidden] = useState(false);
  const [adminActive, setAdminActive] = useState("Members");

  /* E-commerce filters */
  const [filterSearch, setFilterSearch] = useState("");
  const [cats, setCats] = useState<Record<string, boolean>>({
    Prints: true,
    Frames: false,
    Zines: false,
    Stickers: false,
  });
  const [brands, setBrands] = useState<Record<string, boolean>>({
    "Bayer & Co": false,
    Ordered: true,
    Halftone: false,
  });
  const [price, setPrice] = useState<[number, number]>([50, 500]);
  const activeFilters = useMemo(
    () =>
      Object.values(cats).filter(Boolean).length + Object.values(brands).filter(Boolean).length,
    [cats, brands],
  );
  function resetFilters() {
    setCats({ Prints: false, Frames: false, Zines: false, Stickers: false });
    setBrands({ "Bayer & Co": false, Ordered: false, Halftone: false });
    setPrice([0, 500]);
    setFilterSearch("");
  }

  /* Documentation nav */
  const [docsSearch, setDocsSearch] = useState("");
  const [docsActive, setDocsActive] = useState("Installation");
  const [docsOpen, setDocsOpen] = useState<Record<string, boolean>>({
    "Getting started": true,
    "API reference": false,
    Guides: false,
  });
  const docsFiltered = useMemo(() => {
    const q = docsSearch.trim().toLowerCase();
    const out: Record<string, string[]> = {};
    for (const [group, items] of Object.entries(DOCS_TREE)) {
      const hit = q ? items.filter((i) => i.toLowerCase().includes(q)) : items;
      if (hit.length) out[group] = hit;
    }
    return out;
  }, [docsSearch]);

  /* Dual layout */
  const [railActive, setRailActive] = useState("Inbox");
  const [dualActive, setDualActive] = useState("All mail");

  /* Personal dashboard */
  const [personal, setPersonal] = useState([
    { label: "Morning walk", done: true },
    { label: "Read 30 minutes", done: false },
    { label: "Water the plants", done: true },
    { label: "Plan weekend trip", done: false },
  ]);
  const [work, setWork] = useState([
    { label: "Team standup", done: true },
    { label: "Review pull requests", done: false },
    { label: "Prepare demo", done: false },
  ]);

  /* Floating left */
  const [floatCollapsed, setFloatCollapsed] = useState(false);
  const [floatActive, setFloatActive] = useState("Home");
  const [favActive, setFavActive] = useState("");

  /* Right side */
  const [calendars, setCalendars] = useState<
    { label: string; color: TeamColor | "red"; on: boolean }[]
  >([
    { label: "Personal", color: "blue", on: true },
    { label: "Work", color: "green", on: true },
    { label: "Family", color: "purple", on: false },
    { label: "Deadlines", color: "red", on: true },
  ]);

  /* Team switcher */
  const [team, setTeam] = useState(teamNames[0]);
  const [teamActive, setTeamActive] = useState("Roadmap");
  function switchTeam(name: string) {
    if (!TEAMS[name]) return;
    setTeam(name);
    setTeamActive(Object.values(TEAMS[name].groups)[0][0].label);
  }

  /* File tree */
  const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({
    src: true,
    components: true,
    charts: false,
    lib: false,
    public: false,
  });
  const [treeActive, setTreeActive] = useState("DitherSidebar.vue");
  function treeAll(open: boolean) {
    setTreeOpen((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) next[k] = open;
      return next;
    });
  }

  /* Mobile drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActive, setDrawerActive] = useState("Home");
  function drawerPick(label: string) {
    setDrawerActive(label);
    setDrawerOpen(false);
  }

  /* Icon rail */
  const [railOnly, setRailOnly] = useState("Charts");

  return (
    <>
      {/* Basic dashboard */}
      <section id="sidebar-dashboard" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Basic dashboard</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The workhorse frame — washed sidebar with a Main group, count badge,
          an upgrade card pinned above the user row, and a breadcrumb topbar
          whose toggle owns the icon rail.
        </p>
        <DemoCard code={SNIPPET_DASHBOARD}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60">
            <DitherSidebar
              value={dashCollapsed}
              onValueChange={setDashCollapsed}
              label="Dashboard nav"
              variant="washed"
              washColor="blue"
              toggle={false}
              header={
                <div className="flex h-8 items-center gap-2 px-2.5">
                  <span className="inline-block size-2.5 shrink-0 rounded-[2px] bg-foreground" />
                  {!dashCollapsed ? (
                    <span className="text-[12px] tracking-tight">acme.io</span>
                  ) : null}
                </div>
              }
              footer={
                <>
                  {!dashCollapsed ? (
                    <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2.5">
                      <div className="text-[11px] text-foreground">Upgrade to pro</div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                        Unlock exports and presets.
                      </div>
                      <DitherButton
                        color="blue"
                        variant="gradient"
                        className="mt-2 w-full py-1 text-[10px]"
                      >
                        Upgrade
                      </DitherButton>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 border-t border-border/60 px-2 pt-2">
                    <DitherAvatar name="Ada Byte" size={22} />
                    {!dashCollapsed ? (
                      <div className="min-w-0 leading-tight">
                        <div className="truncate text-[11px] text-foreground">Ada Byte</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          ada@acme.io
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              }
            >
              <DitherSidebarGroup label="Main">
                <DitherSidebarItem
                  label="Dashboard"
                  active={dashActive === "Dashboard"}
                  onSelect={() => setDashActive("Dashboard")}
                />
                <DitherSidebarItem
                  label="Projects"
                  badge={12}
                  active={dashActive === "Projects"}
                  onSelect={() => setDashActive("Projects")}
                />
                <DitherSidebarItem
                  label="Team"
                  active={dashActive === "Team"}
                  onSelect={() => setDashActive("Team")}
                />
                <DitherSidebarItem
                  label="Settings"
                  active={dashActive === "Settings"}
                  onSelect={() => setDashActive("Settings")}
                />
              </DitherSidebarGroup>
            </DitherSidebar>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-10 items-center gap-2 border-b border-border/60 px-3">
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  aria-label={dashCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!dashCollapsed}
                  onClick={() => setDashCollapsed(!dashCollapsed)}
                >
                  <span aria-hidden="true" className="text-[12px] leading-none">
                    ▤
                  </span>
                </button>
                <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span>Home</span>
                  <span aria-hidden="true">/</span>
                  <span>Projects</span>
                  <span aria-hidden="true">/</span>
                  <span className="text-foreground">{dashActive}</span>
                </nav>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {DASH_STATS.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-border/60 p-3"
                  >
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                      {label}
                    </div>
                    <div className="mt-1 text-[15px] tabular-nums text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              <div
                className="mx-4 mb-4 flex-1 rounded-md border border-dashed border-border/60"
                aria-hidden="true"
              />
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Admin with profile */}
      <section id="sidebar-admin" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Admin with profile</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A floating admin panel with a quick-actions group, a storage meter card,
          and the signed-in profile pinned to the footer. The topbar hamburger
          hides the whole panel; the red badge keeps triage loud.
        </p>
        <DemoCard code={SNIPPET_ADMIN}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <DitherSidebar
              value={adminHidden}
              onValueChange={setAdminHidden}
              label="Admin nav"
              collapse="hide"
              variant="floating"
              toggle={false}
              header={
                <div className="flex h-8 items-center gap-2 px-2.5">
                  <span className="inline-block size-2.5 shrink-0 rounded-[2px] bg-foreground" />
                  <span className="text-[12px] tracking-tight">admin</span>
                </div>
              }
              footer={
                <>
                  <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-foreground">Storage</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">68%</span>
                    </div>
                    <DitherMeter value={68} className="mt-1.5 h-2 w-full" />
                    <div className="mt-1 text-[10px] text-muted-foreground">6.8 of 10 GB used</div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/60 px-2 pt-2">
                    <DitherAvatar name="Rei Toma" size={22} color="purple" />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[11px] text-foreground">Rei Toma</div>
                      <div className="truncate text-[10px] text-muted-foreground">Owner</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Sign out"
                      className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    >
                      <span aria-hidden="true" className="text-[11px]">
                        ⏻
                      </span>
                    </button>
                  </div>
                </>
              }
            >
              <DitherSidebarGroup label="Manage">
                <DitherSidebarItem
                  label="Members"
                  badge={24}
                  active={adminActive === "Members"}
                  onSelect={() => setAdminActive("Members")}
                />
                <DitherSidebarItem
                  label="Roles"
                  active={adminActive === "Roles"}
                  onSelect={() => setAdminActive("Roles")}
                />
                <DitherSidebarItem
                  label="Audit log"
                  badge="!"
                  color="red"
                  active={adminActive === "Audit log"}
                  onSelect={() => setAdminActive("Audit log")}
                />
              </DitherSidebarGroup>
              <DitherSidebarGroup label="Quick actions">
                <DitherSidebarItem
                  label="New member"
                  active={adminActive === "New member"}
                  onSelect={() => setAdminActive("New member")}
                />
                <DitherSidebarItem
                  label="Create invite"
                  color="green"
                  active={adminActive === "Create invite"}
                  onSelect={() => setAdminActive("Create invite")}
                />
                <DitherSidebarItem
                  label="Support"
                  active={adminActive === "Support"}
                  onSelect={() => setAdminActive("Support")}
                />
              </DitherSidebarGroup>
            </DitherSidebar>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-10 items-center gap-3 border-b border-border/60 px-3">
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  aria-label={adminHidden ? "Show sidebar" : "Hide sidebar"}
                  aria-expanded={!adminHidden}
                  onClick={() => setAdminHidden(!adminHidden)}
                >
                  <span aria-hidden="true" className="text-[13px] leading-none">
                    ☰
                  </span>
                </button>
                <span className="text-[12px] text-foreground">{adminActive}</span>
              </div>
              <div className="grid gap-2 p-4" aria-hidden="true">
                {Array.from({ length: 5 }, (_, idx) => (
                  <div
                    key={idx}
                    className="flex h-8 items-center gap-3 rounded-md border border-border/60 px-3"
                  >
                    <span className="size-3 rounded-[2px] bg-border/70" />
                    <span className={`h-2 rounded-sm bg-border/50 ${ADMIN_WIDTHS[idx]}`} />
                    <span className="ml-auto h-2 w-10 rounded-sm bg-border/40" />
                  </div>
                ))}
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* E-commerce filters */}
      <section id="sidebar-filters" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">E-commerce filters</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A filter rail for a storefront — search, category and brand checkboxes
          with result counts, a two-thumb price range, and apply/reset pinned to
          the footer. The topbar echoes the live filter count.
        </p>
        <DemoCard code={SNIPPET_FILTERS}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60">
            <DitherSidebar
              label="Product filters"
              collapse="none"
              variant="inset"
              className="w-60 border-r border-border/60"
              header={
                <div className="px-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 shrink-0 rounded-[2px] bg-foreground" />
                    <span className="text-[12px] tracking-tight">pixelmart</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">Filter products</div>
                  <DitherInput
                    value={filterSearch}
                    onChange={setFilterSearch}
                    placeholder="Search products…"
                    className="mt-2.5 w-full text-[11px]"
                  />
                </div>
              }
              footer={
                <div className="grid gap-1.5 border-t border-border/60 px-2 pt-2">
                  <DitherButton
                    color="green"
                    variant="gradient"
                    className="w-full py-1.5 text-[11px]"
                  >
                    Apply filters
                  </DitherButton>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={resetFilters}
                  >
                    Reset all
                  </button>
                </div>
              }
            >
              <DitherSidebarGroup label="Categories">
                {Object.entries(CAT_COUNTS).map(([c, count]) => (
                  <label
                    key={c}
                    className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
                  >
                    <DitherCheckbox
                      value={cats[c]}
                      className="text-[11px]"
                      onChange={() => setCats((prev) => ({ ...prev, [c]: !prev[c] }))}
                    >
                      {c}
                    </DitherCheckbox>
                    <span className="ml-auto tabular-nums text-muted-foreground/70">({count})</span>
                  </label>
                ))}
              </DitherSidebarGroup>
              <DitherSidebarGroup label="Price">
                <div className="px-2.5 pt-1">
                  <DitherSlider
                    value={price}
                    min={0}
                    max={500}
                    step={10}
                    label="Price range"
                    color="green"
                    onChange={(v) => setPrice(v as [number, number])}
                  />
                  <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                    <span>${price[0]}</span>
                    <span>${price[1]}</span>
                  </div>
                </div>
              </DitherSidebarGroup>
              <DitherSidebarGroup label="Brands">
                {Object.entries(BRAND_COUNTS).map(([b, count]) => (
                  <label
                    key={b}
                    className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
                  >
                    <DitherCheckbox
                      value={brands[b]}
                      className="text-[11px]"
                      onChange={() => setBrands((prev) => ({ ...prev, [b]: !prev[b] }))}
                    >
                      {b}
                    </DitherCheckbox>
                    <span className="ml-auto tabular-nums text-muted-foreground/70">({count})</span>
                  </label>
                ))}
              </DitherSidebarGroup>
            </DitherSidebar>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-10 items-center justify-between border-b border-border/60 px-4">
                <span className="text-[12px] text-foreground">Products</span>
                <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {activeFilters} filters · ${price[0]}–${price[1]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4" aria-hidden="true">
                {Array.from({ length: 6 }, (_, idx) => (
                  <div key={idx} className="rounded-md border border-border/60 p-2">
                    <div className="aspect-square rounded bg-card/60" />
                    <div className="mt-2 h-2 w-3/4 rounded-sm bg-border/50" />
                    <div className="mt-1 h-2 w-1/3 rounded-sm bg-border/40" />
                  </div>
                ))}
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Documentation nav */}
      <section id="sidebar-docs" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Documentation nav</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A docs tree — version chip, ⌘K search, one section open with the active
          page, the rest folded behind chevrons, and a help card in the footer.
          Compact rows, no icon rail: a docs tree needs its labels.
        </p>
        <DemoCard code={SNIPPET_DOCS}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <DitherSidebar
              label="Docs nav"
              collapse="none"
              density="compact"
              variant="inset"
              className="w-60 border-r border-border/60"
              header={
                <div className="px-2.5">
                  <div className="flex h-8 items-center justify-between">
                    <span className="text-[12px] tracking-tight">dither-ui</span>
                    <span className="rounded border border-border/60 px-1 text-[10px] tabular-nums text-muted-foreground">
                      v2.4
                    </span>
                  </div>
                  <div className="relative">
                    <DitherInput
                      value={docsSearch}
                      onChange={setDocsSearch}
                      placeholder="Search docs…"
                      className="w-full pr-8 text-[11px]"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/60 px-1 text-[9px] text-muted-foreground">
                      ⌘K
                    </span>
                  </div>
                </div>
              }
              footer={
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div className="text-[11px] text-foreground">Need help?</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    Ask in the community or file an issue.
                  </div>
                </div>
              }
            >
              {Object.entries(docsFiltered).map(([group, items]) => (
                <DitherSidebarSub
                  key={group}
                  label={group}
                  value={docsSearch.trim() ? true : docsOpen[group]}
                  onValueChange={(v) => setDocsOpen((prev) => ({ ...prev, [group]: v }))}
                >
                  {items.map((item) => (
                    <DitherSidebarItem
                      key={item}
                      label={item}
                      active={docsActive === item}
                      onSelect={() => setDocsActive(item)}
                    />
                  ))}
                </DitherSidebarSub>
              ))}
              {!Object.keys(docsFiltered).length ? (
                <p className="px-2.5 py-4 text-[11px] text-muted-foreground">
                  No pages match “{docsSearch}”.
                </p>
              ) : null}
            </DitherSidebar>
            <main className="min-w-0 flex-1 overflow-hidden p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Docs / {docsActive}
              </div>
              <div className="mt-2 text-[15px] tracking-tight text-foreground">{docsActive}</div>
              <div className="mt-4 grid gap-2" aria-hidden="true">
                <div className="h-2 w-11/12 rounded-sm bg-border/50" />
                <div className="h-2 w-full rounded-sm bg-border/50" />
                <div className="h-2 w-3/4 rounded-sm bg-border/50" />
                <div className="mt-3 h-20 rounded-md border border-border/60 bg-background/40" />
                <div className="h-2 w-5/6 rounded-sm bg-border/50" />
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Dual layout */}
      <section id="sidebar-dual" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Dual layout</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Two tiers — a permanent icon rail picks the context, a second panel
          shows that context&apos;s tree. The rail is a Sidebar pinned to its rail
          state; the panel is a plain inset Sidebar beside it.
        </p>
        <DemoCard code={SNIPPET_DUAL}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60">
            <DitherSidebar
              label="Context rail"
              collapse="rail"
              value={true}
              toggle={false}
              className="border-r-0"
              header={
                <div className="grid h-8 place-items-center">
                  <span className="inline-block size-2.5 rounded-[2px] bg-foreground" />
                </div>
              }
            >
              {Object.entries(PANELS).map(([name, p]) => (
                <DitherSidebarItem
                  key={name}
                  label={name}
                  active={railActive === name}
                  onSelect={() => {
                    setRailActive(name);
                    setDualActive(p.items[0].label);
                  }}
                />
              ))}
            </DitherSidebar>
            <DitherSidebar
              label="Context panel"
              collapse="none"
              variant="inset"
              className="w-52 border-r border-border/60 bg-background/20"
              header={
                <div className="flex h-8 items-center px-2.5 text-[12px] tracking-tight text-foreground">
                  {PANELS[railActive].title}
                </div>
              }
            >
              {PANELS[railActive].items.map((item) => (
                <DitherSidebarItem
                  key={item.label}
                  label={item.label}
                  badge={item.badge}
                  active={dualActive === item.label}
                  onSelect={() => setDualActive(item.label)}
                />
              ))}
            </DitherSidebar>
            <main className="grid min-w-0 flex-1 place-items-center">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  {railActive}
                </div>
                <div className="mt-1 text-[13px] text-foreground">{dualActive}</div>
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Personal dashboard */}
      <section id="sidebar-personal" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Personal dashboard</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A personal hub — avatar header, a mini month at a glance, and two todo
          lists whose done items strike through. Everything is live: tick a box
          and the footer count follows.
        </p>
        <DemoCard code={SNIPPET_PERSONAL}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <DitherSidebar
              label="Personal hub"
              collapse="none"
              variant="inset"
              className="w-60 border-r border-border/60"
              header={
                <div className="flex items-center gap-2.5 px-2.5">
                  <DitherAvatar name="Mika Dot" size={26} color="purple" />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[12px] text-foreground">Personal hub</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      Organize your day
                    </div>
                  </div>
                </div>
              }
              footer={
                <div className="flex items-center gap-1.5 border-t border-border/60 px-2.5 pt-2 text-[10px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-green-500/80" aria-hidden="true" />
                  {[...personal, ...work].filter((t) => t.done).length} of{" "}
                  {personal.length + work.length} done — synced
                </div>
              }
            >
              <DitherSidebarGroup label="Calendar">
                <div className="px-2.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <button
                      type="button"
                      aria-label="Previous month"
                      className="grid size-5 place-items-center rounded hover:bg-card hover:text-foreground"
                    >
                      ‹
                    </button>
                    <span className="uppercase tracking-[0.15em]">Jul 2026</span>
                    <button
                      type="button"
                      aria-label="Next month"
                      className="grid size-5 place-items-center rounded hover:bg-card hover:text-foreground"
                    >
                      ›
                    </button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground/70">
                    {DOW.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="mt-0.5 grid grid-cols-7 gap-0.5 text-center text-[10px] tabular-nums">
                    {calCells.map((day, i) => (
                      <span
                        key={i}
                        className={`grid h-5 place-items-center rounded-[3px] ${
                          day === CAL_TODAY
                            ? "bg-card text-foreground ring-1 ring-border"
                            : day
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        {day ?? ""}
                      </span>
                    ))}
                  </div>
                </div>
              </DitherSidebarGroup>
              <DitherSidebarGroup label="Personal">
                {personal.map((t, i) => (
                  <label
                    key={t.label}
                    className="flex h-7 cursor-pointer items-center rounded-md px-2.5 text-[11px] transition-colors hover:bg-card/60"
                  >
                    <DitherCheckbox
                      value={t.done}
                      color="purple"
                      className="text-[11px]"
                      onChange={() =>
                        setPersonal((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, done: !x.done } : x)),
                        )
                      }
                    >
                      <span
                        className={
                          t.done
                            ? "text-muted-foreground/60 line-through"
                            : "text-muted-foreground"
                        }
                      >
                        {t.label}
                      </span>
                    </DitherCheckbox>
                  </label>
                ))}
              </DitherSidebarGroup>
              <DitherSidebarGroup label="Work">
                {work.map((t, i) => (
                  <label
                    key={t.label}
                    className="flex h-7 cursor-pointer items-center rounded-md px-2.5 text-[11px] transition-colors hover:bg-card/60"
                  >
                    <DitherCheckbox
                      value={t.done}
                      color="green"
                      className="text-[11px]"
                      onChange={() =>
                        setWork((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, done: !x.done } : x)),
                        )
                      }
                    >
                      <span
                        className={
                          t.done
                            ? "text-muted-foreground/60 line-through"
                            : "text-muted-foreground"
                        }
                      >
                        {t.label}
                      </span>
                    </DitherCheckbox>
                  </label>
                ))}
              </DitherSidebarGroup>
            </DitherSidebar>
            <main className="grid min-w-0 flex-1 place-items-center text-[12px] text-muted-foreground">
              Stay organized, stay focused
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Floating left */}
      <section id="sidebar-floating" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Floating left</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A detached card over the canvas — workspace switcher up top, search,
          primary rows with an inbox badge, and favorites that truncate
          gracefully. Collapses to the icon rail like any other Sidebar.
        </p>
        <DemoCard code={SNIPPET_FLOATING}>
          <div className="relative mx-auto h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <div
              className="absolute inset-0 grid place-items-center text-[12px] text-muted-foreground"
              aria-hidden="true"
            >
              Canvas
            </div>
            <DitherSidebar
              value={floatCollapsed}
              onValueChange={setFloatCollapsed}
              label="Workspace nav"
              variant="floating"
              className="relative h-[calc(100%-1rem)]"
              header={
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/40 p-1.5 text-left transition-colors hover:bg-card"
                    aria-label="Switch workspace"
                  >
                    <DitherAvatar name="Acme Inc" size={22} color="blue" />
                    {!floatCollapsed ? (
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[11px] text-foreground">Acme Inc</span>
                        <span className="block truncate text-[9px] text-muted-foreground">
                          Enterprise
                        </span>
                      </span>
                    ) : null}
                    {!floatCollapsed ? (
                      <span aria-hidden="true" className="text-[10px] text-muted-foreground">
                        ⇅
                      </span>
                    ) : null}
                  </button>
                  {!floatCollapsed ? (
                    <DitherInput placeholder="Search…" className="mt-2 w-full text-[11px]" />
                  ) : null}
                </>
              }
              footer={
                <div className="flex items-center gap-2 border-t border-border/60 px-2 pt-2">
                  <DitherAvatar name="Juno Bit" size={22} color="green" />
                  {!floatCollapsed ? (
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-[11px] text-foreground">Juno Bit</div>
                      <div className="truncate text-[10px] text-muted-foreground">juno@acme.io</div>
                    </div>
                  ) : null}
                </div>
              }
            >
              <DitherSidebarItem
                label="Assistant"
                color="purple"
                active={floatActive === "Assistant"}
                onSelect={() => setFloatActive("Assistant")}
              />
              <DitherSidebarItem
                label="Home"
                active={floatActive === "Home"}
                onSelect={() => setFloatActive("Home")}
              />
              <DitherSidebarItem
                label="Inbox"
                badge={10}
                active={floatActive === "Inbox"}
                onSelect={() => setFloatActive("Inbox")}
              />
              <DitherSidebarGroup label="Favorites">
                {FAVORITES.map((f) => (
                  <DitherSidebarItem
                    key={f}
                    label={f}
                    active={favActive === f}
                    onSelect={() => {
                      setFavActive(f);
                      setFloatActive("");
                    }}
                  />
                ))}
              </DitherSidebarGroup>
            </DitherSidebar>
          </div>
        </DemoCard>
      </section>

      {/* Right side */}
      <section id="sidebar-right" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Right side</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The same Sidebar flipped to the right edge — a profile header, the mini
          month, and calendar toggles with their color dots. The topbar button
          hides the whole panel when the content needs the room.
        </p>
        <DemoCard code={SNIPPET_RIGHT}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60">
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-10 items-center justify-between border-b border-border/60 px-3">
                <span className="text-[12px] text-foreground">July 2026</span>
                <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {calendars.filter((c) => c.on).length} calendars shown
                </span>
              </div>
              <div className="grid flex-1 grid-cols-7 gap-px bg-border/40 p-px" aria-hidden="true">
                {Array.from({ length: 35 }, (_, idx) => (
                  <div key={idx} className="bg-background/80" />
                ))}
              </div>
            </main>
            <DitherSidebar
              label="Calendar panel"
              side="right"
              collapse="none"
              variant="inset"
              className="w-56 border-l border-border/60 bg-card/20"
              header={
                <div className="flex items-center gap-2.5 px-2.5">
                  <DitherAvatar name="Juno Bit" size={24} color="green" />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[12px] text-foreground">Juno Bit</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      juno@dither-ui.com
                    </div>
                  </div>
                </div>
              }
              footer={
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <span aria-hidden="true">+</span> New calendar
                </button>
              }
            >
              <DitherSidebarGroup label="Calendar">
                <div className="px-2.5">
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground/70">
                    {DOW.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="mt-0.5 grid grid-cols-7 gap-0.5 text-center text-[10px] tabular-nums">
                    {calCells.map((day, i) => (
                      <span
                        key={i}
                        className={`grid h-5 place-items-center rounded-[3px] ${
                          day === CAL_TODAY
                            ? "bg-card text-foreground ring-1 ring-border"
                            : day
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        {day ?? ""}
                      </span>
                    ))}
                  </div>
                </div>
              </DitherSidebarGroup>
              <DitherSidebarGroup label="My calendars">
                {calendars.map((c, i) => (
                  <label
                    key={c.label}
                    className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
                  >
                    <DitherCheckbox
                      value={c.on}
                      color={c.color}
                      className="text-[11px]"
                      onChange={() =>
                        setCalendars((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, on: !x.on } : x)),
                        )
                      }
                    >
                      {c.label}
                    </DitherCheckbox>
                    <span
                      className="ml-auto size-1.5 rounded-full"
                      style={{ backgroundColor: `var(--swatch-${c.color}, currentColor)` }}
                      aria-hidden="true"
                    />
                  </label>
                ))}
              </DitherSidebarGroup>
            </DitherSidebar>
          </div>
        </DemoCard>
      </section>

      {/* Team switcher */}
      <section id="sidebar-teams" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Team switcher</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          One sidebar, three workspaces — the header dropdown swaps the whole
          identity: wash color, accent, groups, badges. Arrow keys walk the menu;
          Escape returns focus to the trigger.
        </p>
        <DemoCard code={SNIPPET_TEAMS}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60">
            <DitherSidebar
              label="Workspace nav"
              variant="washed"
              washColor={TEAMS[team].color}
              collapse="none"
              className="w-60"
              header={
                <DitherMenu items={teamNames.map((n) => ({ label: n }))} onSelect={switchTeam}>
                  <span className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/40 p-1.5 text-left transition-colors hover:bg-card">
                    <DitherAvatar name={team} size={22} color={TEAMS[team].color} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[11px] text-foreground">{team}</span>
                      <span className="block truncate text-[9px] text-muted-foreground">
                        {TEAMS[team].plan}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-[10px] text-muted-foreground">
                      ⇅
                    </span>
                  </span>
                </DitherMenu>
              }
            >
              {Object.entries(TEAMS[team].groups).map(([group, items]) => (
                <DitherSidebarGroup key={group} label={group}>
                  {items.map((item) => (
                    <DitherSidebarItem
                      key={item.label}
                      label={item.label}
                      badge={item.badge}
                      color={TEAMS[team].color}
                      active={teamActive === item.label}
                      onSelect={() => setTeamActive(item.label)}
                    />
                  ))}
                </DitherSidebarGroup>
              ))}
            </DitherSidebar>
            <main className="grid min-w-0 flex-1 place-items-center">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  {team}
                </div>
                <div className="mt-1 text-[13px] text-foreground">{teamActive}</div>
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* File tree */}
      <section id="sidebar-tree" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">File tree</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sub-menus nest — an explorer three levels deep with expand/collapse
          all, rail guides on every level, and a selected file the header echoes.
        </p>
        <DemoCard code={SNIPPET_TREE}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <DitherSidebar
              label="File explorer"
              collapse="none"
              density="compact"
              variant="inset"
              className="w-60 border-r border-border/60"
              header={
                <div className="flex h-8 items-center justify-between px-2.5">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                    Explorer
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Expand all folders"
                      className="grid size-5 place-items-center rounded text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      onClick={() => treeAll(true)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label="Collapse all folders"
                      className="grid size-5 place-items-center rounded text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      onClick={() => treeAll(false)}
                    >
                      −
                    </button>
                  </span>
                </div>
              }
            >
              <DitherSidebarSub
                label="src"
                value={treeOpen.src}
                onValueChange={(v) => setTreeOpen((prev) => ({ ...prev, src: v }))}
              >
                <DitherSidebarSub
                  label="components"
                  value={treeOpen.components}
                  onValueChange={(v) => setTreeOpen((prev) => ({ ...prev, components: v }))}
                >
                  <DitherSidebarItem
                    label="DitherSidebar.vue"
                    active={treeActive === "DitherSidebar.vue"}
                    onSelect={() => setTreeActive("DitherSidebar.vue")}
                  />
                  <DitherSidebarItem
                    label="DitherButton.vue"
                    active={treeActive === "DitherButton.vue"}
                    onSelect={() => setTreeActive("DitherButton.vue")}
                  />
                  <DitherSidebarItem
                    label="DitherInput.vue"
                    active={treeActive === "DitherInput.vue"}
                    onSelect={() => setTreeActive("DitherInput.vue")}
                  />
                </DitherSidebarSub>
                <DitherSidebarSub
                  label="charts"
                  value={treeOpen.charts}
                  onValueChange={(v) => setTreeOpen((prev) => ({ ...prev, charts: v }))}
                >
                  <DitherSidebarItem
                    label="AreaChart.vue"
                    active={treeActive === "AreaChart.vue"}
                    onSelect={() => setTreeActive("AreaChart.vue")}
                  />
                  <DitherSidebarItem
                    label="Sparkline.vue"
                    active={treeActive === "Sparkline.vue"}
                    onSelect={() => setTreeActive("Sparkline.vue")}
                  />
                </DitherSidebarSub>
                <DitherSidebarSub
                  label="lib"
                  value={treeOpen.lib}
                  onValueChange={(v) => setTreeOpen((prev) => ({ ...prev, lib: v }))}
                >
                  <DitherSidebarItem
                    label="palette.ts"
                    active={treeActive === "palette.ts"}
                    onSelect={() => setTreeActive("palette.ts")}
                  />
                  <DitherSidebarItem
                    label="pixel.ts"
                    active={treeActive === "pixel.ts"}
                    onSelect={() => setTreeActive("pixel.ts")}
                  />
                </DitherSidebarSub>
                <DitherSidebarItem
                  label="index.ts"
                  active={treeActive === "index.ts"}
                  onSelect={() => setTreeActive("index.ts")}
                />
              </DitherSidebarSub>
              <DitherSidebarSub
                label="public"
                value={treeOpen.public}
                onValueChange={(v) => setTreeOpen((prev) => ({ ...prev, public: v }))}
              >
                <DitherSidebarItem
                  label="faces.webp"
                  active={treeActive === "faces.webp"}
                  onSelect={() => setTreeActive("faces.webp")}
                />
                <DitherSidebarItem
                  label="sprites.webp"
                  active={treeActive === "sprites.webp"}
                  onSelect={() => setTreeActive("sprites.webp")}
                />
              </DitherSidebarSub>
            </DitherSidebar>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-9 items-center border-b border-border/60 px-3 text-[11px] text-muted-foreground">
                <span className="text-foreground">{treeActive}</span>
              </div>
              <div className="grid flex-1 gap-1.5 p-4" aria-hidden="true">
                {Array.from({ length: 8 }, (_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-sm bg-border/40 ${ADMIN_WIDTHS[idx % ADMIN_WIDTHS.length]}`}
                  />
                ))}
              </div>
            </main>
          </div>
        </DemoCard>
      </section>

      {/* Mobile drawer */}
      <section id="sidebar-drawer" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Mobile drawer</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Below the breakpoint the sidebar rides in a drawer — hamburger opens,
          picking a destination closes, swipe dismisses. Groups and items work
          standalone inside any panel.
        </p>
        <DemoCard code={SNIPPET_DRAWER}>
          <div className="relative mx-auto flex h-96 w-64 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border/60 px-3">
              <button
                type="button"
                aria-label="Open navigation"
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                onClick={() => setDrawerOpen(true)}
              >
                <span aria-hidden="true" className="text-[13px] leading-none">
                  ☰
                </span>
              </button>
              <span className="text-[12px] text-foreground">{drawerActive}</span>
            </div>
            <div className="grid flex-1 content-start gap-2 p-3" aria-hidden="true">
              <div className="h-24 rounded-md border border-border/60 bg-card/40" />
              <div className="h-2 w-3/4 rounded-sm bg-border/50" />
              <div className="h-2 w-1/2 rounded-sm bg-border/50" />
              <div className="h-16 rounded-md border border-border/60 bg-card/40" />
            </div>
            <DitherDrawer
              open={drawerOpen}
              side="left"
              title="Navigation"
              onClose={() => setDrawerOpen(false)}
            >
              <DitherSidebarGroup label="Browse">
                {["Home", "Discover", "Library"].map((item) => (
                  <DitherSidebarItem
                    key={item}
                    label={item}
                    active={drawerActive === item}
                    onSelect={() => drawerPick(item)}
                  />
                ))}
              </DitherSidebarGroup>
              <DitherSidebarGroup label="You">
                <DitherSidebarItem
                  label="Saved"
                  badge={8}
                  active={drawerActive === "Saved"}
                  onSelect={() => drawerPick("Saved")}
                />
                <DitherSidebarItem
                  label="Settings"
                  active={drawerActive === "Settings"}
                  onSelect={() => drawerPick("Settings")}
                />
              </DitherSidebarGroup>
            </DitherDrawer>
          </div>
        </DemoCard>
      </section>

      {/* Icon rail */}
      <section id="sidebar-rail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Icon rail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The whole nav in 56 pixels — a permanent rail where tooltips carry the
          labels, badges fold to colored dots, and the footer keeps the person.
        </p>
        <DemoCard code={SNIPPET_RAIL}>
          <div className="mx-auto flex h-80 max-w-md overflow-hidden rounded-lg border border-border/60">
            <DitherSidebar
              label="Rail nav"
              collapse="rail"
              value={true}
              toggle={false}
              header={
                <div className="grid h-8 place-items-center">
                  <span className="inline-block size-2.5 rounded-[2px] bg-foreground" />
                </div>
              }
              footer={
                <div className="grid place-items-center border-t border-border/60 pt-2">
                  <DitherAvatar name="Ada Byte" size={22} />
                </div>
              }
            >
              {RAIL_ITEMS.map((item) => (
                <DitherTooltip key={item.label} text={item.label}>
                  <DitherSidebarItem
                    label={item.label}
                    badge={item.badge}
                    color={item.color}
                    active={railOnly === item.label}
                    onSelect={() => setRailOnly(item.label)}
                  />
                </DitherTooltip>
              ))}
            </DitherSidebar>
            <main className="grid min-w-0 flex-1 place-items-center text-[12px] text-muted-foreground">
              {railOnly}
            </main>
          </div>
        </DemoCard>
      </section>
    </>
  );
}
