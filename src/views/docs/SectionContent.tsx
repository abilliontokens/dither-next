"use client";

import { PaletteSection } from "./PaletteSection";
import { OverviewPack } from "./OverviewPack";
import { HandbookPack } from "./HandbookPack";
import { ExamplesCorePack } from "./ExamplesCorePack";
import { AuthExamples } from "./examples/AuthExamples";
import { ProductExamples } from "./examples/ProductExamples";
import { SidebarExamples } from "./examples/SidebarExamples";
import { StatsExamples } from "./examples/StatsExamples";
import { TableExamples } from "./examples/TableExamples";
import { ChatExamples } from "./examples/ChatExamples";
import { NotificationsExamples } from "./examples/NotificationsExamples";
import { ChartsDocs } from "./components/ChartsDocs";
import { FormDocs } from "./components/FormDocs";
import { FieldDocs } from "./components/FieldDocs";
import { SelectionDocs } from "./components/SelectionDocs";
import { FeedbackDocs } from "./components/FeedbackDocs";
import { StructureDocs } from "./components/StructureDocs";
import { LayoutDocs } from "./components/LayoutDocs";
import { MediaDocs } from "./components/MediaDocs";
import { OverlayDocs } from "./components/OverlayDocs";
import { SurfaceDocs } from "./components/SurfaceDocs";
import { NavigationDocs } from "./components/NavigationDocs";
import { GenerativeDocs } from "./components/GenerativeDocs";
import { DataDocs } from "./components/DataDocs";
import { BackgroundsDocs } from "./backgrounds/BackgroundsDocs";
import { TextDocs } from "./text/TextDocs";
import { AnimationsDocs } from "./animations/AnimationsDocs";
/**
 * DocsSections — the entire docs body, every section pack concatenated on one
 * long scrollable page. Port of `src/pages/docs/DocsPage.vue`, which renders
 * all packs inline in nav-registry order (Overview · Handbook · Examples ·
 * Components · Utils).
 *
 * The Vue docs is a SINGLE long page: the sidebar's IntersectionObserver
 * scroll-spy drives `activeId` as the reader scrolls top-to-bottom through
 * every section, and `history.replaceState` keeps the URL in sync so each
 * `/docs/<id>` is a shareable deep link to the same page. The Next.js port
 * must match that model — it previously routed each section id to its own URL
 * and rendered only that section's pack via `packOf()`, which meant
 * `/docs/getting-started` could never scroll to "Palette" (different pack,
 * different route) and the scroll-spy only cycled within one pack.
 *
 * Packs are rendered in nav-registry GROUPS order so the section order on the
 * page matches the sidebar IA exactly. `PaletteSection` (Utils) renders last,
 * matching Vue's placement of the `palette` section after `NavigationDocs`.
 *
 * Each pack is a self-contained client component (sections + snippets + local
 * state) — the per-pack shape from `src/pages/docs/AGENTS.md` is preserved;
 * only the page-level composition changed from "one pack per route" to "all
 * packs on one route".
 */
export function DocsSections() {
  return (
    <>
      <OverviewPack />
      <HandbookPack />
      <ExamplesCorePack />
      <AuthExamples />
      <ProductExamples />
      <SidebarExamples />
      <StatsExamples />
      <TableExamples />
      <ChatExamples />
      <NotificationsExamples />
      <ChartsDocs />
      <FormDocs />
      <FieldDocs />
      <SelectionDocs />
      <FeedbackDocs />
      <StructureDocs />
      <LayoutDocs />
      <MediaDocs />
      <OverlayDocs />
      <SurfaceDocs />
      <NavigationDocs />
      <GenerativeDocs />
      <DataDocs />
      <BackgroundsDocs />
      <TextDocs />
      <AnimationsDocs />
      <PaletteSection />
    </>
  );
}
