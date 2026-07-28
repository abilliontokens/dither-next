"use client";

import { SidebarContext } from "./sidebar-context";
import { cn } from "./lib";

export interface DitherRailProps {
  label?: string;
  /** Which edge it sits on — flips the border. */
  side?: "left" | "right";
  className?: string;
  /** Header slot (above the nav). */
  header?: React.ReactNode;
  /** Footer slot (below the nav). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * DitherRail — permanent icon rail, the whole nav in 56px. Provides the
 * sidebar's collapsed context so DitherSidebarItem children fold their labels
 * automatically; wrap items in DitherTooltip to carry the labels.
 * Verbatim port of DitherRail.vue.
 */
export function DitherRail({
  label = "Rail",
  side = "left",
  className,
  header,
  footer,
  children,
}: DitherRailProps) {
  const edge = side === "right" ? "border-l" : "border-r";

  return (
    <SidebarContext value={{ collapsed: true, compact: false }}>
      <aside
        aria-label={label}
        className={cn(
          "flex h-full w-14 shrink-0 flex-col p-2",
          edge,
          "border-border/60 bg-background/40",
          className,
        )}
      >
        {header}
        <nav className="mt-2 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
          {children}
        </nav>
        {footer}
      </aside>
    </SidebarContext>
  );
}
