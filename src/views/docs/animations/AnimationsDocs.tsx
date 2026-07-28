"use client";

import { useState } from "react";

import {
  DitherAnimatedContent,
  DitherAntigravity,
  DitherBlobCursor,
  DitherBouncyAccordion,
  DitherCardStack,
  DitherClickSpark,
  DitherCrosshair,
  DitherCubes,
  DitherDock,
  DitherElectricBorder,
  DitherExpandTabs,
  DitherExpandingArrow,
  DitherFadeContent,
  DitherGhostCursor,
  DitherGlareHover,
  DitherGooeyMenu,
  DitherGradualBlur,
  DitherHoldAction,
  DitherImageTrail,
  DitherIsland,
  DitherLaserFlow,
  DitherLogoLoop,
  DitherMagicRings,
  DitherMagnet,
  DitherMagnetLines,
  DitherMetaBalls,
  DitherMetallicPaint,
  DitherNoise,
  DitherNotificationStack,
  DitherOrbitImages,
  DitherPixelTrail,
  DitherPixelTransition,
  DitherPreviewRail,
  DitherRibbons,
  DitherScrollProgress,
  DitherShapeBlur,
  DitherSlideAction,
  DitherSnapButton,
  DitherSplashCursor,
  DitherStarBorder,
  DitherStickerPeel,
  DitherStrands,
  DitherTargetCursor,
  DitherWalletCard,
} from "@dither-kit";
import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

const SHARED_CANVAS: PropRow[] = [
  { prop: "opacity", type: "number (0-1)", default: "1" },
  { prop: "dither", type: "number (0-1) | boolean", default: "1" },
  { prop: "paused", type: "boolean", default: "false" },
  { prop: "mixBlendMode", type: "string", default: "undefined" },
  { prop: "seed", type: "number", default: "undefined" },
];

const API: Record<string, PropRow[]> = {
  animatedContent: [
    { prop: "distance", type: "number (px)", default: "40" },
    { prop: "direction", type: '"vertical" | "horizontal"', default: '"vertical"' },
    { prop: "reverse", type: "boolean", default: "false" },
    { prop: "duration", type: "number (ms)", default: "800" },
    { prop: "delay", type: "number (ms)", default: "0" },
    { prop: "children", type: "content", default: "—" },
  ],
  fadeContent: [
    { prop: "duration", type: "number (ms)", default: "1000" },
    { prop: "delay", type: "number (ms)", default: "0" },
    { prop: "blur", type: "boolean", default: "false" },
    { prop: "children", type: "content", default: "—" },
  ],
  gradualBlur: [
    { prop: "position", type: '"bottom" | "top"', default: '"bottom"' },
    { prop: "height", type: "number (px)", default: "96" },
    { prop: "strength", type: "number (px)", default: "4" },
    { prop: "children", type: "content", default: "—" },
  ],
  starBorder: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "speed", type: "number (s)", default: "6" },
    { prop: "thickness", type: "number (px)", default: "1" },
    { prop: "children", type: "content", default: "—" },
  ],
  electricBorder: [
    { prop: "color", type: "string (hex)", default: '"#5227FF"' },
    { prop: "speed", type: "number", default: "1" },
    { prop: "thickness", type: "number (px)", default: "2" },
    { prop: "children", type: "content", default: "—" },
  ],
  glareHover: [{ prop: "children", type: "content", default: "—" }],
  magnet: [
    { prop: "strength", type: "number (0-1)", default: "0.4" },
    { prop: "radius", type: "number (px)", default: "200" },
    { prop: "children", type: "content", default: "—" },
  ],
  clickSpark: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "count", type: "number", default: "8" },
    { prop: "size", type: "number (px)", default: "16" },
    { prop: "duration", type: "number (ms)", default: "420" },
    { prop: "children", type: "content", default: "—" },
  ],
  blobCursor: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "size", type: "number (px)", default: "48" },
    { prop: "lag", type: "number (0-1)", default: "0.18" },
    { prop: "children", type: "content", default: "—" },
  ],
  crosshair: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "thickness", type: "number (px)", default: "1" },
    { prop: "children", type: "content", default: "—" },
  ],
  ghostCursor: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "count", type: "number", default: "18" },
    { prop: "size", type: "number (px)", default: "10" },
    { prop: "children", type: "content", default: "—" },
  ],
  splashCursor: [
    { prop: "color", type: "string (hex)", default: '"#3DA5FF"' },
    { prop: "maxRadius", type: "number (px)", default: "60" },
    { prop: "duration", type: "number (ms)", default: "700" },
    { prop: "children", type: "content", default: "—" },
  ],
  targetCursor: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "size", type: "number (px)", default: "36" },
    { prop: "children", type: "content", default: "—" },
  ],
  pixelTrail: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "gap", type: "number (px)", default: "24" },
    { prop: "children", type: "content", default: "—" },
  ],
  imageTrail: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CFF67', ...]" },
    { prop: "size", type: "number (px)", default: "40" },
    { prop: "duration", type: "number (ms)", default: "650" },
    { prop: "children", type: "content", default: "—" },
  ],
  metaBalls: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CFF67', '#3DA5FF']" },
    { prop: "count", type: "number", default: "6" },
    { prop: "speed", type: "number", default: "1" },
    { prop: "ballSize", type: "number", default: "1" },
    { prop: "glow", type: "number", default: "1.5" },
    { prop: "mouseInteraction", type: "boolean", default: "true" },
    ...SHARED_CANVAS,
  ],
  metallicPaint: [
    { prop: "colors", type: "string[] (hex)", default: "['#1A1A22', '#8890A0', '#E8ECF4']" },
    { prop: "scale", type: "number", default: "3" },
    { prop: "speed", type: "number", default: "0.4" },
    { prop: "distortion", type: "number", default: "0.6" },
    ...SHARED_CANVAS,
  ],
  noise: [
    { prop: "colors", type: "string[] (hex)", default: "['#3DA5FF', '#7CE0FF', '#FFFFFF']" },
    { prop: "speed", type: "number", default: "1" },
    { prop: "density", type: "number (0-1)", default: "0.5" },
    { prop: "opacity", type: "number (0-1)", default: "1" },
    { prop: "paused", type: "boolean", default: "false" },
  ],
  cubes: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CFF67', '#CFFFDF']" },
    { prop: "scale", type: "number", default: "6" },
    { prop: "speed", type: "number", default: "0.4" },
    ...SHARED_CANVAS,
  ],
  ribbons: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CFF67', '#3DA5FF']" },
    { prop: "count", type: "number", default: "5" },
    { prop: "thickness", type: "number", default: "0.12" },
    { prop: "amplitude", type: "number", default: "1" },
    { prop: "mouseInteraction", type: "boolean", default: "true" },
    ...SHARED_CANVAS,
  ],
  shapeBlur: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CFF67']" },
    { prop: "size", type: "number", default: "0.4" },
    { prop: "softness", type: "number", default: "0.3" },
    { prop: "mouseInteraction", type: "boolean", default: "true" },
    ...SHARED_CANVAS,
  ],
  strands: [
    { prop: "colors", type: "string[] (hex)", default: "['#5227FF', '#7CE0FF']" },
    { prop: "count", type: "number", default: "40" },
    { prop: "sway", type: "number", default: "0.15" },
    { prop: "lineWidth", type: "number", default: "0.01" },
    ...SHARED_CANVAS,
  ],
  laserFlow: [
    { prop: "colors", type: "string[] (hex)", default: "['#FF3D2E', '#FFD23D', '#FFFFFF']" },
    { prop: "count", type: "number", default: "4" },
    { prop: "beamWidth", type: "number", default: "0.02" },
    { prop: "glow", type: "number", default: "1" },
    ...SHARED_CANVAS,
  ],
  antigravity: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "count", type: "number", default: "40" },
    { prop: "speed", type: "number", default: "1" },
    { prop: "children", type: "content", default: "—" },
  ],
  logoLoop: [
    { prop: "items", type: "string[]", default: "['DITHER', 'BAYER', ...]" },
    { prop: "speed", type: "number (s)", default: "18" },
    { prop: "gap", type: "number (px)", default: "48" },
  ],
  magicRings: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "count", type: "number", default: "4" },
    { prop: "duration", type: "number (s)", default: "3" },
    { prop: "children", type: "content", default: "—" },
  ],
  magnetLines: [
    { prop: "color", type: "string (hex)", default: '"#7CFF67"' },
    { prop: "gap", type: "number (px)", default: "28" },
    { prop: "lineLength", type: "number (px)", default: "14" },
    { prop: "children", type: "content", default: "—" },
  ],
  orbitImages: [
    { prop: "items", type: "string[]", default: "['A', 'B', 'C', 'D', 'E']" },
    { prop: "radius", type: "number (px)", default: "80" },
    { prop: "duration", type: "number (s)", default: "16" },
    { prop: "size", type: "number (px)", default: "200" },
  ],
  pixelTransition: [
    { prop: "rows", type: "number", default: "6" },
    { prop: "cols", type: "number", default: "10" },
    { prop: "color", type: "string (hex)", default: '"#111318"' },
    { prop: "children", type: "content", default: "—" },
  ],
  stickerPeel: [{ prop: "children", type: "content", default: "—" }],
  expandTabs: [
    { prop: "tabs", type: "{ value, label, color? }[]", default: "required" },
    { prop: "value", type: "string (controlled) — active tab", default: "required" },
    { prop: "color", type: "PixelColor — active glyph fallback", default: '"blue"' },
    { prop: "onChange", type: "(value: string)", default: "—" },
  ],
  island: [
    { prop: "value", type: "boolean (controlled) — expanded", default: "false" },
    { prop: "label", type: "string — compact row text", default: '"Status"' },
    { prop: "color", type: "PixelColor — status dot", default: '"green"' },
    { prop: "live", type: "boolean — pulse the dot while collapsed", default: "true" },
    { prop: "children", type: "detail panel content", default: "—" },
    { prop: "onChange", type: "(value: boolean)", default: "—" },
  ],
  cardStack: [
    { prop: "items", type: "T[] — cycled forever", default: "required" },
    { prop: "depth", type: "number — visible under-cards", default: "2" },
    { prop: "children", type: "render prop: (item, index, top) => ReactNode", default: "card face fallback" },
    { prop: "onAdvance", type: "(index: number) — after a card flies out", default: "—" },
  ],
  dock: [
    { prop: "items", type: "{ value, label, color? }[]", default: "required" },
    { prop: "magnify", type: "number — peak scale over the pointer", default: "1.7" },
    { prop: "range", type: "number (px) — gaussian falloff radius", default: "80" },
    { prop: "onSelect", type: "(value: string)", default: "—" },
  ],
  previewRail: [
    { prop: "items", type: "{ value, label, hint?, color? }[]", default: "required" },
    { prop: "value", type: "string (controlled) — active destination", default: "undefined" },
    { prop: "range", type: "number (px) — pyramid falloff radius", default: "56" },
    { prop: "side", type: '"left" | "right" — edge the rail hugs', default: '"left"' },
    { prop: "onChange", type: "(value: string)", default: "—" },
  ],
  scrollProgress: [
    { prop: "attach", type: '"viewport" | "parent"', default: '"viewport"' },
    { prop: "edge", type: '"top" | "bottom"', default: '"top"' },
    { prop: "color", type: "PixelColor", default: '"green"' },
  ],
  snapButton: [
    { prop: "threshold", type: "number (px) — displacement that arms the snap", default: "64" },
    { prop: "axis", type: '"x" | "y" | "both"', default: '"x"' },
    { prop: "color", type: "PixelColor — armed accent", default: '"green"' },
    { prop: "onSnap", type: "() — armed release, or Enter/Space", default: "—" },
    { prop: "children", type: "label content", default: '"Pull to confirm"' },
  ],
  gooeyMenu: [
    { prop: "items", type: "{ value, label, color? }[]", default: "required" },
    { prop: "value", type: "boolean (controlled) — expanded", default: "false" },
    { prop: "direction", type: '"up" | "down" | "left" | "right"', default: '"up"' },
    { prop: "spacing", type: "number (px) — gap between item centers", default: "52" },
    { prop: "onSelect", type: "(value: string) — also collapses", default: "—" },
    { prop: "onChange", type: "(value: boolean)", default: "—" },
  ],
  bouncyAccordion: [
    { prop: "items", type: "{ value, label, hint?, icon?, color?, content? }[]", default: "required" },
    { prop: "value", type: 'string (controlled) — open item, "" closes all', default: '""' },
    { prop: "color", type: "PixelColor — icon fallback tint", default: '"blue"' },
    { prop: "slots", type: "Record<value, ReactNode> — rich panel content (else item.content)", default: "—" },
    { prop: "onChange", type: "(value: string)", default: "—" },
  ],
  expandingArrow: [
    { prop: "color", type: "PixelColor — tile and trail accent", default: '"blue"' },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "children", type: "label content", default: '"Explore the kit"' },
  ],
  slideAction: [
    { prop: "label", type: "string — track text and thumb aria-label", default: '"Slide to confirm"' },
    { prop: "color", type: "PixelColor — thumb accent", default: '"green"' },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "onConfirm", type: "() — thumb reached the end, or Enter/Space", default: "—" },
  ],
  holdAction: [
    { prop: "duration", type: "number (ms) — hold time to complete", default: "1200" },
    { prop: "direction", type: '"vertical" | "horizontal" — fill axis', default: '"vertical"' },
    { prop: "color", type: "PixelColor — fill and crest accent", default: '"orange"' },
    { prop: "disabled", type: "boolean", default: "false" },
    { prop: "onComplete", type: "() — fill reached full; once per hold", default: "—" },
    { prop: "children", type: "label content", default: "—" },
  ],
  walletCard: [
    { prop: "accounts", type: "{ value, label, address, balance, change?, color? }[]", default: "required" },
    { prop: "value", type: "string (controlled) — selected account", default: "first account" },
    { prop: "balance / change", type: "number — override the active account's numbers", default: "account data" },
    { prop: "currency", type: "string — balance prefix", default: '"$"' },
    { prop: "notifications", type: "boolean — unread pulse on the bell", default: "false" },
    { prop: "color", type: "PixelColor — card accent", default: '"green"' },
    { prop: "onChange", type: "(value: string)", default: "—" },
    { prop: "onAction", type: '("send" | "deposit" | "swap" | "buy")', default: "—" },
    { prop: "onSearch", type: "(query: string) — live text on every keystroke", default: "—" },
    { prop: "onSubmit", type: "(query: string) — Enter or a recent row", default: "—" },
    { prop: "onNotify", type: "() — bell pressed", default: "—" },
  ],
  notificationStack: [
    { prop: "items", type: "{ id, title, body?, time?, icon?, color? }[]", default: "required" },
    { prop: "value", type: "boolean (controlled) — pinned open; hover/focus expand transiently", default: "false" },
    { prop: "maxVisible", type: "number — cards shown in the stack and list", default: "3" },
    { prop: "collapsedLabel", type: "string — header + toggle aria-label", default: '"Notifications"' },
    { prop: "expandedLabel", type: "string — view-all button text", default: '"View all"' },
    { prop: "emptyLabel", type: "string — empty-state card", default: '"All caught up"' },
    { prop: "variant", type: '"stack" | "fan" | "condensed" — collapsed silhouette', default: '"stack"' },
    { prop: "color", type: "PixelColor — icon fallback tint", default: '"blue"' },
    { prop: "onChange", type: "(expanded: boolean)", default: "—" },
    { prop: "onViewAll", type: "() — view-all pressed", default: "—" },
  ],
};

const SNIPPETS = {
  animatedContent: `<DitherAnimatedContent distance={40} direction="vertical">
  <YourCard />
</DitherAnimatedContent>`,
  fadeContent: `<DitherFadeContent blur>
  <YourCard />
</DitherFadeContent>`,
  gradualBlur: `<DitherGradualBlur position="bottom" height={96}>
  <ScrollingList />
</DitherGradualBlur>`,
  starBorder: `<DitherStarBorder color="#7CFF67">Star border</DitherStarBorder>`,
  electricBorder: `<DitherElectricBorder color="#5227FF">Electric border</DitherElectricBorder>`,
  glareHover: `<DitherGlareHover><YourCard /></DitherGlareHover>`,
  magnet: `<DitherMagnet strength={0.4}><button>Magnet</button></DitherMagnet>`,
  clickSpark: `<DitherClickSpark color="#7CFF67"><YourArea /></DitherClickSpark>`,
  blobCursor: `<DitherBlobCursor color="#7CFF67" className="h-40"><YourArea /></DitherBlobCursor>`,
  crosshair: `<DitherCrosshair color="#7CFF67" className="h-40"><YourArea /></DitherCrosshair>`,
  ghostCursor: `<DitherGhostCursor color="#7CFF67" className="h-40"><YourArea /></DitherGhostCursor>`,
  splashCursor: `<DitherSplashCursor color="#3DA5FF" className="h-40"><YourArea /></DitherSplashCursor>`,
  targetCursor: `<DitherTargetCursor color="#7CFF67" className="h-40"><YourArea /></DitherTargetCursor>`,
  pixelTrail: `<DitherPixelTrail color="#7CFF67" className="h-40"><YourArea /></DitherPixelTrail>`,
  imageTrail: `<DitherImageTrail className="h-44"><YourArea /></DitherImageTrail>`,
  metaBalls: `<DitherMetaBalls className="h-64" />`,
  metallicPaint: `<DitherMetallicPaint className="h-64" />`,
  noise: `<DitherNoise className="h-64" />`,
  cubes: `<DitherCubes className="h-64" />`,
  ribbons: `<DitherRibbons className="h-64" />`,
  shapeBlur: `<DitherShapeBlur className="h-64" />`,
  strands: `<DitherStrands className="h-64" />`,
  laserFlow: `<DitherLaserFlow className="h-64" />`,
  antigravity: `<DitherAntigravity className="h-52"><YourContent /></DitherAntigravity>`,
  logoLoop: `<DitherLogoLoop items={['DITHER', 'BAYER', 'CANVAS', 'VUE', 'PIXELS']} />`,
  magicRings: `<DitherMagicRings className="h-52"><YourContent /></DitherMagicRings>`,
  magnetLines: `<DitherMagnetLines className="h-52" />`,
  orbitImages: `<DitherOrbitImages items={['A', 'B', 'C', 'D', 'E']} />`,
  pixelTransition: `<DitherPixelTransition><YourCard /></DitherPixelTransition>`,
  stickerPeel: `<DitherStickerPeel><YourCard /></DitherStickerPeel>`,
  expandTabs: `<DitherExpandTabs value={tab} onChange={setTab} tabs={[
  { value: 'home', label: 'Home' },
  { value: 'library', label: 'Library', color: 'purple' },
  { value: 'alerts', label: 'Alerts', color: 'red' },
]} />  {/* only the active tab unfolds its label */}`,
  island: `<DitherIsland value={open} onChange={setOpen} label="Deploy running" color="green" live>
  Build 214 · lint ok · 3 of 5 steps done.  {/* unfolds beneath the pill */}
</DitherIsland>`,
  cardStack: `<DitherCardStack items={cards} className="h-44 w-64">
  {(item) => <article className="h-full rounded-lg border bg-card p-4">{item.title}</article>}
</DitherCardStack>  {/* drag horizontally · flick advances · cycles */}`,
  dock: `<DitherDock items={[
  { value: 'home', label: 'Home' },
  { value: 'studio', label: 'Studio', color: 'purple' },
  { value: 'docs', label: 'Docs', color: 'green' },
  { value: 'alerts', label: 'Alerts', color: 'red' },
]} onSelect={go} />  {/* gaussian magnify around the pointer */}`,
  previewRail: `<DitherPreviewRail value={dest} onChange={setDest} items={[
  { value: 'inbox', label: 'Inbox', hint: '12 unread threads', color: 'blue' },
  { value: 'drafts', label: 'Drafts', hint: '2 in progress', color: 'purple' },
  { value: 'planner', label: 'Planner', hint: 'Sprint 14 — day 3', color: 'green' },
  { value: 'metrics', label: 'Metrics', hint: 'p95 latency 42ms', color: 'orange' },
  { value: 'settings', label: 'Settings', hint: 'Workspace + theme' },
]} />  {/* ticks pyramid around the pointer · preview floats beside the rail */}`,
  scrollProgress: `<DitherScrollProgress />                    {/* viewport, fixed top */}
<DitherScrollProgress attach="parent" color="purple" />  {/* nearest scrollable parent */}`,
  snapButton: `<DitherSnapButton threshold={64} axis="x" color="green" onSnap={confirm}>
  Pull to deploy
</DitherSnapButton>
{/* 1:1 drag · rubber-band past the line · border arms at the threshold ·
     release fires onSnap · Enter/Space fires without the pull */}`,
  gooeyMenu: `<DitherGooeyMenu value={open} onChange={setOpen} items={[
  { value: 'add', label: 'Add', color: 'green' },
  { value: 'export', label: 'Export', color: 'blue' },
  { value: 'share', label: 'Share', color: 'purple' },
]} direction="up" onSelect={run} />
{/* one SVG goo filter fuses the circles while they travel */}`,
  bouncyAccordion: `<DitherBouncyAccordion value={panel} onChange={setPanel} items={[
  { value: 'overview', label: 'Overview', hint: 'What shipped this week', icon: '▤',
    content: 'Charts, buttons and backgrounds now share one Bayer engine.' },
  { value: 'activity', label: 'Activity', hint: '3 deploys, 1 rollback', icon: '◷', color: 'green',
    content: 'Build 214 settled after a weighted spring — 8% overshoot, then calm.' },
  { value: 'alerts', label: 'Alerts', hint: 'One flapping check', icon: '◈', color: 'orange',
    content: 'p95 latency wobbled at 04:00 and snapped back on its own.' },
]} />  {/* single-open · spring overshoot on open · brisk close */}`,
  expandingArrow: `<DitherExpandingArrow color="blue" onClick={explore}>
  Explore the kit
</DitherExpandingArrow>  {/* dotted trail unrolls on hover or focus */}`,
  slideAction: `<DitherSlideAction label="Slide to deploy" color="green" onConfirm={deploy} />
{/* 1:1 thumb drag · flick momentum counts · early release springs back ·
     Enter/Space confirms without the slide */}`,
  holdAction: `<DitherHoldAction duration={1200} direction="vertical" color="orange" onComplete={purge}>
  Hold to purge cache
</DitherHoldAction>  {/* liquid fill with a dotted crest · release early to drain */}`,
  walletCard: `<DitherWalletCard value={account} onChange={setAccount} accounts={[
  { value: 'main', label: 'Main', address: '0x7f3a9c2e14b7d55aa93d', balance: 12480.52, change: 2.4 },
  { value: 'savings', label: 'Savings', address: '0x8b21e0c4a6f9d1327e55', balance: 8210.11, change: -1.1, color: 'purple' },
  { value: 'trading', label: 'Trading', address: '0x91cc4db2e87a30f6b214', balance: 3033.7, change: 0.6, color: 'orange' },
]} notifications
  onAction={run} onSubmit={find} onNotify={openInbox} />
{/* switcher + search morph from their triggers · digits cascade ·
     privacy masks to ******* · copy-address gives a ✓ · bell pulses */}`,
  notificationStack: `<DitherNotificationStack value={pinned} onChange={setPinned} items={[
  { id: 'n1', title: 'Deploy finished', body: 'dither-ui → production in 42s', time: '2m', icon: '↑', color: 'green' },
  { id: 'n2', title: 'New comment', body: 'Rei: "the drum snaps beautifully"', time: '16m', icon: '▤', color: 'blue' },
  { id: 'n3', title: 'Build warning', body: 'chunk index.js is 447 kB', time: '1h', icon: '◈', color: 'orange' },
]} onViewAll={openInbox} />
{/* stacked summary → readable list on hover, focus or tap · tap pins ·
     spring fan-out with per-card stagger */}`,
};

const cardBox = "grid h-28 w-52 place-items-center rounded-lg border border-border/60 bg-card text-sm text-muted-foreground";
const cursorArea = "grid h-40 w-full place-items-center rounded-lg border border-border/60 text-sm text-muted-foreground";
const canvasBox = "h-64 w-full overflow-hidden rounded-lg border border-border/60";

export function AnimationsDocs() {
  const [expandTab, setExpandTab] = useState("home");
  const [islandOpen, setIslandOpen] = useState(false);
  const STACK_CARDS = [
    { title: "Prints · riso on cream", color: "purple" },
    { title: "Frames · oak 24×30", color: "blue" },
    { title: "Zines · issue 04", color: "green" },
    { title: "Stickers · die-cut set", color: "orange" },
  ];
  const [stackIndex, setStackIndex] = useState(0);
  const [dockPick, setDockPick] = useState("—");
  const [railDest, setRailDest] = useState("inbox");
  const [snapCount, setSnapCount] = useState(0);
  const [gooeyOpen, setGooeyOpen] = useState(false);
  const [gooeyPick, setGooeyPick] = useState("—");
  const [bouncyPanel, setBouncyPanel] = useState("overview");
  const [slideCount, setSlideCount] = useState(0);
  const [holdCount, setHoldCount] = useState(0);
  const [walletAccount, setWalletAccount] = useState("main");
  const [walletNote, setWalletNote] = useState("—");
  const [stackPinned, setStackPinned] = useState(false);
  const [stackNote, setStackNote] = useState("—");
  const STACK_VARIANTS = ["stack", "fan", "condensed"] as const;
  const [stackVariant, setStackVariant] = useState<(typeof STACK_VARIANTS)[number]>("stack");
  const WALLET_ACCOUNTS = [
    { value: "main", label: "Main", address: "0x7f3a9c2e14b7d55aa93d", balance: 12480.52, change: 2.4 },
    { value: "savings", label: "Savings", address: "0x8b21e0c4a6f9d1327e55", balance: 8210.11, change: -1.1, color: "purple" },
    { value: "trading", label: "Trading", address: "0x91cc4db2e87a30f6b214", balance: 3033.7, change: 0.6, color: "orange" },
  ];
  return (
    <>
      {/* Animated content */}
      <section id="animated-content" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Animated content</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Wrap anything to have it slide and fade into place the first time it enters
          the viewport. Direction, distance and timing are configurable.
        </p>
        <DemoCard code={SNIPPETS.animatedContent}>
          <DitherAnimatedContent distance={40}><div className={cardBox}>Slides up on view</div></DitherAnimatedContent>
        </DemoCard>
        <PropsTable rows={API.animatedContent} />
      </section>

      {/* Fade content */}
      <section id="fade-content" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Fade content</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A pure fade-in on view, optionally de-blurring as it appears. The lighter
          cousin of Animated content when you only want opacity.
        </p>
        <DemoCard code={SNIPPETS.fadeContent}>
          <DitherFadeContent blur><div className={cardBox}>Fades in on view</div></DitherFadeContent>
        </DemoCard>
        <PropsTable rows={API.fadeContent} />
      </section>

      {/* Gradual blur */}
      <section id="gradual-blur" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Gradual blur</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A masked <code className="text-foreground/80">backdrop-filter</code> strip that
          progressively blurs toward an edge — the iOS-style soft fade over a scroll
          region.
        </p>
        <DemoCard code={SNIPPETS.gradualBlur}>
          <DitherGradualBlur position="bottom" height={72} strength={5} className="w-64">
            <div className="space-y-1 text-[13px] leading-relaxed text-muted-foreground">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <p key={n}>Row {n} — content scrolls under the blur band.</p>
              ))}
            </div>
          </DitherGradualBlur>
        </DemoCard>
        <PropsTable rows={API.gradualBlur} />
      </section>

      {/* Star border */}
      <section id="star-border" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Star border</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A rounded frame with two bright glints traveling its top and bottom edges —
          a subtle animated outline for a CTA or badge.
        </p>
        <DemoCard code={SNIPPETS.starBorder}>
          <DitherStarBorder color="#7CFF67">Star border</DitherStarBorder>
        </DemoCard>
        <PropsTable rows={API.starBorder} />
      </section>

      {/* Electric border */}
      <section id="electric-border" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Electric border</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An SVG turbulence filter jitters the frame edge into a crackling electric
          outline. Reduced motion drops the displacement.
        </p>
        <DemoCard code={SNIPPETS.electricBorder}>
          <DitherElectricBorder color="#5227FF">Electric border</DitherElectricBorder>
        </DemoCard>
        <PropsTable rows={API.electricBorder} />
      </section>

      {/* Glare hover */}
      <section id="glare-hover" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Glare hover</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A diagonal sheen sweeps across the surface on hover — the glossy-card
          reflection, done with a single masked gradient. Hover the card.
        </p>
        <DemoCard code={SNIPPETS.glareHover}>
          <DitherGlareHover><div className={cardBox}>Hover me</div></DitherGlareHover>
        </DemoCard>
        <PropsTable rows={API.glareHover} />
      </section>

      {/* Magnet */}
      <section id="magnet" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Magnet</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The wrapped element is pulled toward the pointer while it is within range,
          easing back when the cursor leaves. Move your cursor near the button.
        </p>
        <DemoCard code={SNIPPETS.magnet}>
          <DitherMagnet strength={0.4}>
            <button type="button" className="rounded-md border border-border/60 bg-card px-4 py-2 text-sm">Magnet</button>
          </DitherMagnet>
        </DemoCard>
        <PropsTable rows={API.magnet} />
      </section>

      {/* Click spark */}
      <section id="click-spark" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Click spark</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A burst of spark lines radiates from every click inside the area, drawn on a
          lightweight canvas overlay. Click anywhere in the preview.
        </p>
        <DemoCard code={SNIPPETS.clickSpark}>
          <DitherClickSpark color="#7CFF67" className="grid h-40 w-full place-items-center rounded-lg border border-border/60">
            <span className="text-sm text-muted-foreground">Click anywhere here</span>
          </DitherClickSpark>
        </DemoCard>
        <PropsTable rows={API.clickSpark} />
      </section>

      {/* Blob cursor */}
      <section id="blob-cursor" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Blob cursor</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A soft, screen-blended blob eases toward the pointer inside the area — a
          gooey cursor companion. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.blobCursor}>
          <DitherBlobCursor className={cursorArea}>Move your cursor here</DitherBlobCursor>
        </DemoCard>
        <PropsTable rows={API.blobCursor} />
      </section>

      {/* Crosshair */}
      <section id="crosshair" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Crosshair</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Full-height and full-width guide lines track the pointer across the area — a
          precision reticle. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.crosshair}>
          <DitherCrosshair className={cursorArea}>Move your cursor here</DitherCrosshair>
        </DemoCard>
        <PropsTable rows={API.crosshair} />
      </section>

      {/* Ghost cursor */}
      <section id="ghost-cursor" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Ghost cursor</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A tapering trail of fading dots chases the pointer on a canvas overlay.
          Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.ghostCursor}>
          <DitherGhostCursor className={cursorArea}>Move your cursor here</DitherGhostCursor>
        </DemoCard>
        <PropsTable rows={API.ghostCursor} />
      </section>

      {/* Splash cursor */}
      <section id="splash-cursor" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Splash cursor</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Expanding ripple rings bloom along the pointer path, like drops on water.
          Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.splashCursor}>
          <DitherSplashCursor className={cursorArea}>Move your cursor here</DitherSplashCursor>
        </DemoCard>
        <PropsTable rows={API.splashCursor} />
      </section>

      {/* Target cursor */}
      <section id="target-cursor" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Target cursor</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A slowly rotating corner-bracket reticle locks onto the pointer — a HUD
          targeting frame. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.targetCursor}>
          <DitherTargetCursor className={cursorArea}>Move your cursor here</DitherTargetCursor>
        </DemoCard>
        <PropsTable rows={API.targetCursor} />
      </section>

      {/* Pixel trail */}
      <section id="pixel-trail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pixel trail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The pointer lights up cells of a pixel grid that then fade back out — a
          glowing wake across the lattice. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.pixelTrail}>
          <DitherPixelTrail className={cursorArea}>Move your cursor here</DitherPixelTrail>
        </DemoCard>
        <PropsTable rows={API.pixelTrail} />
      </section>

      {/* Image trail */}
      <section id="image-trail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Image trail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Tiles from a palette drop along the pointer path, rotating and shrinking as
          they fade — pass real image URLs via <code className="text-foreground/80">colors</code>
          swapped for tiles here. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.imageTrail}>
          <DitherImageTrail className="grid h-44 w-full place-items-center rounded-lg border border-border/60 text-sm text-muted-foreground">Move your cursor here</DitherImageTrail>
        </DemoCard>
        <PropsTable rows={API.imageTrail} />
      </section>

      {/* Meta balls */}
      <section id="meta-balls" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Meta balls</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Orbiting blobs fuse into a gooey metaball iso-surface, tinted and
          ordered-dithered through the kit engine. The pointer adds a blob.
        </p>
        <DemoCard code={SNIPPETS.metaBalls}>
          <div className={canvasBox}><DitherMetaBalls /></div>
        </DemoCard>
        <PropsTable rows={API.metaBalls} />
      </section>

      {/* Metallic paint */}
      <section id="metallic-paint" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Metallic paint</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Iterative domain-warped reflections read as flowing liquid chrome — fully
          opaque, dithered across a metallic ramp.
        </p>
        <DemoCard code={SNIPPETS.metallicPaint}>
          <div className={canvasBox}><DitherMetallicPaint /></div>
        </DemoCard>
        <PropsTable rows={API.metallicPaint} />
      </section>

      {/* Noise */}
      <section id="noise" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Noise</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Animated hashed grain thresholded against the Bayer matrix — living static
          for a texture overlay. Tune <code className="text-foreground/80">density</code> and blend it over content.
        </p>
        <DemoCard code={SNIPPETS.noise}>
          <div className={canvasBox}><DitherNoise /></div>
        </DemoCard>
        <PropsTable rows={API.noise} />
      </section>

      {/* Cubes */}
      <section id="cubes" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Cubes</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A rhombille tiling shades into a field of isometric cubes, each face lit and
          pulsing on noise. Tinted and ordered-dithered.
        </p>
        <DemoCard code={SNIPPETS.cubes}>
          <div className={canvasBox}><DitherCubes /></div>
        </DemoCard>
        <PropsTable rows={API.cubes} />
      </section>

      {/* Ribbons */}
      <section id="ribbons" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Ribbons</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Thick flowing bands ride wavy fbm centerlines, bright at the core and tinted
          per ribbon. The pointer bends nearby ribbons toward it.
        </p>
        <DemoCard code={SNIPPETS.ribbons}>
          <div className={canvasBox}><DitherRibbons /></div>
        </DemoCard>
        <PropsTable rows={API.ribbons} />
      </section>

      {/* Shape blur */}
      <section id="shape-blur" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Shape blur</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A big soft blob morphs on noise and drifts toward the pointer — a gentle
          out-of-focus shape. Move your cursor over it.
        </p>
        <DemoCard code={SNIPPETS.shapeBlur}>
          <div className={canvasBox}><DitherShapeBlur /></div>
        </DemoCard>
        <PropsTable rows={API.shapeBlur} />
      </section>

      {/* Strands */}
      <section id="strands" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Strands</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Dozens of thin filaments sway on fbm like blown hair, tinted by depth and
          ordered-dithered with transparent gaps.
        </p>
        <DemoCard code={SNIPPETS.strands}>
          <div className={canvasBox}><DitherStrands /></div>
        </DemoCard>
        <PropsTable rows={API.strands} />
      </section>

      {/* Laser flow */}
      <section id="laser-flow" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Laser flow</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sharp horizontal beams sweep with additive bloom and a faint jitter, tinted
          per beam — a scanning laser array.
        </p>
        <DemoCard code={SNIPPETS.laserFlow}>
          <div className={canvasBox}><DitherLaserFlow /></div>
        </DemoCard>
        <PropsTable rows={API.laserFlow} />
      </section>

      {/* Antigravity */}
      <section id="antigravity" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Antigravity</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A field of motes drifts upward and wraps — gravity in reverse, layered
          behind your content.
        </p>
        <DemoCard code={SNIPPETS.antigravity}>
          <DitherAntigravity className={cursorArea}>Antigravity</DitherAntigravity>
        </DemoCard>
        <PropsTable rows={API.antigravity} />
      </section>

      {/* Logo loop */}
      <section id="logo-loop" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Logo loop</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A seamless infinite marquee of items — pass logos or wordmarks and it loops
          forever with a measured wrap.
        </p>
        <DemoCard code={SNIPPETS.logoLoop}>
          <div className="w-full text-xl font-medium tracking-tight text-muted-foreground">
            <DitherLogoLoop items={["DITHER", "BAYER", "CANVAS", "VUE", "PIXELS"]} />
          </div>
        </DemoCard>
        <PropsTable rows={API.logoLoop} />
      </section>

      {/* Magic rings */}
      <section id="magic-rings" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Magic rings</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Concentric rings pulse outward from the center on a stagger — a radar-ping
          halo around whatever you wrap.
        </p>
        <DemoCard code={SNIPPETS.magicRings}>
          <DitherMagicRings className="h-52 w-full">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-card text-xs text-muted-foreground">core</span>
          </DitherMagicRings>
        </DemoCard>
        <PropsTable rows={API.magicRings} />
      </section>

      {/* Magnet lines */}
      <section id="magnet-lines" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Magnet lines</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A grid of little needles all swivel to point at the pointer, like iron
          filings over a magnet. Move your cursor over the box.
        </p>
        <DemoCard code={SNIPPETS.magnetLines}>
          <DitherMagnetLines className={cursorArea} />
        </DemoCard>
        <PropsTable rows={API.magnetLines} />
      </section>

      {/* Orbit images */}
      <section id="orbit-images" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Orbit images</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Items ride a circular orbit around a center point — pass avatars, logos or
          labels. Counter-rotated so they stay upright.
        </p>
        <DemoCard code={SNIPPETS.orbitImages}>
          <div className="grid min-h-56 place-items-center">
            <DitherOrbitImages items={["A", "B", "C", "D", "E"]} />
          </div>
        </DemoCard>
        <PropsTable rows={API.orbitImages} />
      </section>

      {/* Pixel transition */}
      <section id="pixel-transition" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Pixel transition</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A grid of pixel cells covers the content and dissolves in a scattered order
          on hover, revealing what is underneath. Hover the card.
        </p>
        <DemoCard code={SNIPPETS.pixelTransition}>
          <DitherPixelTransition className="grid h-32 w-56 place-items-center rounded-lg border border-border/60" color="#181b22">
            <span className="text-lg tracking-tight">Revealed</span>
          </DitherPixelTransition>
        </DemoCard>
        <PropsTable rows={API.pixelTransition} />
      </section>

      {/* Sticker peel */}
      <section id="sticker-peel" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Sticker peel</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A corner of the card peels up on hover with a soft curl shadow — the sticker
          lift. Hover the card.
        </p>
        <DemoCard code={SNIPPETS.stickerPeel}>
          <DitherStickerPeel>
            <div className="grid h-24 w-40 place-items-center rounded-lg border border-border/60 bg-card text-sm text-muted-foreground">Peel me</div>
          </DitherStickerPeel>
        </DemoCard>
        <PropsTable rows={API.stickerPeel} />
      </section>
      {/* Expand tabs */}
      <section id="expand-tabs" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Expand tabs</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An icon bar where only the active tab unfolds its label — the rest stay square
          glyphs. The label slides through the house 0fr grid trick.
        </p>
        <DemoCard code={SNIPPETS.expandTabs}>
          <div className="grid min-h-24 place-items-center">
            <DitherExpandTabs
              value={expandTab}
              onChange={setExpandTab}
              tabs={[
                { value: "home", label: "Home" },
                { value: "library", label: "Library", color: "purple" },
                { value: "alerts", label: "Alerts", color: "red" },
              ]}
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.expandTabs} />
      </section>

      {/* Island */}
      <section id="island" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Island</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A morphing status pill — the compact row keeps its pulse while the detail
          unfolds beneath. Escape collapses; reduced motion snaps.
        </p>
        <DemoCard code={SNIPPETS.island}>
          <div className="grid min-h-28 place-items-center">
            <DitherIsland value={islandOpen} onChange={setIslandOpen} label="Deploy running" color="green" live className="w-64">
              Build 214 · lint ok · bundle 84kB · 3 of 5 steps done.
            </DitherIsland>
          </div>
        </DemoCard>
        <PropsTable rows={API.island} />
      </section>

      {/* Card stack */}
      <section id="card-stack" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Card stack</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A swipe deck on the kit&apos;s own gesture math — 1:1 tracking, rubber-band past
          the edge, a flick or a far drag sends the card flying and the stack rises. Drag
          the top card.
        </p>
        <DemoCard code={SNIPPETS.cardStack}>
          <div className="grid min-h-56 place-items-center">
            <div>
              <DitherCardStack items={STACK_CARDS} className="h-40 w-64" onAdvance={setStackIndex}>
                {(item) => (
                  <article className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-card/90 p-4">
                    <span className="size-2 rounded-[2px]" style={{ background: `var(--swatch-${item.color})` }} aria-hidden="true" />
                    <p className="font-mono text-[13px] text-foreground">{item.title}</p>
                  </article>
                )}
              </DitherCardStack>
              <p className="mt-3 text-center text-[10px] tabular-nums text-muted-foreground">card {stackIndex + 1} of {STACK_CARDS.length}</p>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.cardStack} />
      </section>

      {/* Dock */}
      <section id="dock" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Dock</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A hover-magnifying dock — items swell on a gaussian falloff around the pointer
          and settle when it leaves. Reduced motion keeps the row still.
        </p>
        <DemoCard code={SNIPPETS.dock}>
          <div className="grid min-h-28 place-items-end justify-center pb-2">
            <div className="text-center">
              <DitherDock
                items={[
                  { value: "home", label: "Home" },
                  { value: "studio", label: "Studio", color: "purple" },
                  { value: "docs", label: "Docs", color: "green" },
                  { value: "alerts", label: "Alerts", color: "red" },
                ]}
                onSelect={setDockPick}
              />
              <p className="mt-2 text-[10px] text-muted-foreground">selected: {dockPick}</p>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.dock} />
      </section>

      {/* Preview rail */}
      <section id="preview-rail" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Preview rail</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A Codex app-inspired navigation rail — compact ticks form a pyramid around the
          pointer and reveal a floating destination preview beside the rail. Keyboard
          focus previews too; reduced motion keeps the ticks still.
        </p>
        <DemoCard code={SNIPPETS.previewRail}>
          <div className="flex min-h-56 items-center justify-start pl-6">
            <DitherPreviewRail
              value={railDest}
              onChange={setRailDest}
              items={[
                { value: "inbox", label: "Inbox", hint: "12 unread threads", color: "blue" },
                { value: "drafts", label: "Drafts", hint: "2 in progress", color: "purple" },
                { value: "planner", label: "Planner", hint: "Sprint 14 — day 3", color: "green" },
                { value: "metrics", label: "Metrics", hint: "p95 latency 42ms", color: "orange" },
                { value: "settings", label: "Settings", hint: "Workspace + theme" },
              ]}
            />
            <p className="ml-10 text-[10px] text-muted-foreground">destination: {railDest}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.previewRail} />
      </section>

      {/* Scroll progress */}
      <section id="scroll-progress" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Scroll progress</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Reading progress as a dithered bar — it composes DitherProgress and rides the
          viewport edge, or the top of any scrollable parent. Scroll the box.
        </p>
        <DemoCard code={SNIPPETS.scrollProgress}>
          <div className="relative mx-auto h-48 max-w-md overflow-y-auto rounded-lg border border-border/60">
            <DitherScrollProgress attach="parent" color="purple" />
            <div className="grid gap-2 p-4" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className={`h-2 rounded-sm bg-border/50 ${i % 3 === 0 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.scrollProgress} />
      </section>

      {/* Snap button */}
      <section id="snap-button" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Snap button</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Pull to confirm — drag past the line and the border arms; release fires and the
          button springs home. Short pulls just spring. Enter and Space fire without the
          pull; reduced motion skips the spring.
        </p>
        <DemoCard code={SNIPPETS.snapButton}>
          <div className="grid min-h-28 place-items-center gap-3">
            <DitherSnapButton threshold={64} axis="x" color="green" onSnap={() => setSnapCount((c) => c + 1)}>
              Pull to deploy
            </DitherSnapButton>
            <p className="text-[10px] tabular-nums text-muted-foreground">deploys fired: {snapCount}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.snapButton} />
      </section>

      {/* Gooey menu */}
      <section id="gooey-menu" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Gooey menu</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Actions that melt out of one trigger — an SVG goo filter fuses the circles while
          they travel, then they settle apart. Escape collapses; reduced motion drops the
          travel.
        </p>
        <DemoCard code={SNIPPETS.gooeyMenu}>
          <div className="grid min-h-64 place-items-end justify-center pb-4">
            <div className="text-center">
              <DitherGooeyMenu
                value={gooeyOpen}
                onChange={setGooeyOpen}
                direction="up"
                items={[
                  { value: "add", label: "Add", color: "green" },
                  { value: "export", label: "Export", color: "blue" },
                  { value: "share", label: "Share", color: "purple" },
                ]}
                onSelect={setGooeyPick}
              />
              <p className="mt-3 text-[10px] text-muted-foreground">picked: {gooeyPick}</p>
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.gooeyMenu} />
      </section>

      {/* Bouncy accordion */}
      <section id="bouncy-accordion" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Bouncy accordion</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A single-open accordion with a weighted spring layout — panels overshoot and
          settle on a sampled damped-spring easing, icon rows lead each header, and
          content rises into view. Reduced motion reveals instantly.
        </p>
        <DemoCard code={SNIPPETS.bouncyAccordion}>
          <DitherBouncyAccordion
            value={bouncyPanel}
            onChange={setBouncyPanel}
            className="mx-auto max-w-sm"
            items={[
              { value: "overview", label: "Overview", hint: "What shipped this week", icon: "▤", content: "Charts, buttons and backgrounds now share one Bayer engine." },
              { value: "activity", label: "Activity", hint: "3 deploys, 1 rollback", icon: "◷", color: "green", content: "Build 214 settled after a weighted spring — 8% overshoot, then calm." },
              { value: "alerts", label: "Alerts", hint: "One flapping check", icon: "◈", color: "orange", content: "p95 latency wobbled at 04:00 and snapped back on its own." },
            ]}
          />
        </DemoCard>
        <PropsTable rows={API.bouncyAccordion} />
      </section>

      {/* Expanding arrow */}
      <section id="expanding-arrow" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Expanding arrow</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An accent tile that expands into a dotted-arrow trail on hover or focus — the
          trail is stamped from the same accent hue. Reduced motion reveals it instantly.
        </p>
        <DemoCard code={SNIPPETS.expandingArrow}>
          <div className="flex min-h-24 items-center justify-center">
            <DitherExpandingArrow color="blue">Explore the kit</DitherExpandingArrow>
          </div>
        </DemoCard>
        <PropsTable rows={API.expandingArrow} />
      </section>

      {/* Slide action */}
      <section id="slide-action" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Slide action</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Drag the thumb to the end of the track to confirm — flick momentum counts — or
          release early and it springs back. Enter or Space confirms without the slide.
        </p>
        <DemoCard code={SNIPPETS.slideAction}>
          <div className="flex min-h-24 flex-col items-center justify-center gap-3">
            <DitherSlideAction label="Slide to deploy" color="green" onConfirm={() => setSlideCount((c) => c + 1)} />
            <p className="font-mono text-[10px] text-muted-foreground">deploys: {slideCount}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.slideAction} />
      </section>

      {/* Hold action */}
      <section id="hold-action" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Hold action</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Hold to complete — a liquid fill with a dotted crest rises (or slides) while you
          press; release early and it drains back. A held Enter or Space works the same
          way.
        </p>
        <DemoCard code={SNIPPETS.holdAction}>
          <div className="flex min-h-24 flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-4">
              <DitherHoldAction color="orange" onComplete={() => setHoldCount((c) => c + 1)}>Hold to purge cache</DitherHoldAction>
              <DitherHoldAction direction="horizontal" color="red" duration={900} onComplete={() => setHoldCount((c) => c + 1)}>Hold to delete</DitherHoldAction>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">completed: {holdCount}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.holdAction} />
      </section>

      {/* Wallet card */}
      <section id="wallet-card" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Wallet card</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A wallet overview card — the account switcher and search morph open from their
          triggers, the balance cascades in with a change pill and privacy toggle, the
          address copies with feedback, the bell carries an unread pulse, and Send /
          Deposit / Swap / Buy report through one event.
        </p>
        <DemoCard code={SNIPPETS.walletCard}>
          <div className="flex min-h-72 flex-col items-center justify-center gap-3">
            <DitherWalletCard
              value={walletAccount}
              onChange={setWalletAccount}
              accounts={WALLET_ACCOUNTS}
              notifications
              onAction={(name) => setWalletNote(name)}
              onSubmit={(q) => setWalletNote("search: " + q)}
              onNotify={() => setWalletNote("notifications")}
            />
            <p className="font-mono text-[10px] text-muted-foreground">last: {walletNote}</p>
          </div>
        </DemoCard>
        <PropsTable rows={API.walletCard} />
      </section>

      {/* Notification stack */}
      <section id="notification-stack" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Notification stack</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Compact notification cards that spring from a stacked summary into a readable
          list on hover, focus or tap — tap pins the list open, and the view-all row
          appears with the expansion. Reduced motion snaps.
        </p>
        <DemoCard code={SNIPPETS.notificationStack}>
          <div className="flex min-h-72 flex-col items-center justify-center gap-4">
            <DitherNotificationStack
              value={stackPinned}
              onChange={setStackPinned}
              variant={stackVariant}
              items={[
                { id: "n1", title: "Deploy finished", body: "dither-ui → production in 42s", time: "2m", icon: "↑", color: "green" },
                { id: "n2", title: "New comment", body: "Rei: “the drum snaps beautifully”", time: "16m", icon: "▤", color: "blue" },
                { id: "n3", title: "Build warning", body: "chunk index.js is 447 kB", time: "1h", icon: "◈", color: "orange" },
              ]}
              onViewAll={() => setStackNote("view all")}
            />
            <p className="font-mono text-[10px] text-muted-foreground">pinned: {String(stackPinned)} · last: {stackNote}</p>
            <div className="flex gap-1">
              {STACK_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={stackVariant === v}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${stackVariant === v ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setStackVariant(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </DemoCard>
        <PropsTable rows={API.notificationStack} />
      </section>
    </>
  );
}
