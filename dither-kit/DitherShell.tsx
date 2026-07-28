import { cn } from "./lib";

export interface DitherShellProps {
  /** true draws the embedded card chrome — border, rounding, clip. */
  frame?: boolean;
  className?: string;
  /** Topbar slot (above the aside + content pair). */
  topbar?: React.ReactNode;
  /** Aside slot (left of the main content). */
  aside?: React.ReactNode;
  /** Statusbar slot (under the aside + content pair). */
  statusbar?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * DitherShell — app frame: topbar over an aside + content pair, optional
 * statusbar under. Regions render only when their slot is filled — the grid
 * adapts. Verbatim port of DitherShell.vue.
 */
export function DitherShell({
  frame = false,
  className,
  topbar,
  aside,
  statusbar,
  children,
}: DitherShellProps) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-background text-foreground",
        frame && "overflow-hidden rounded-lg border border-border/60",
        className,
      )}
    >
      {topbar ? (
        <header className="flex items-center border-b border-border/60">
          {topbar}
        </header>
      ) : (
        <div aria-hidden="true" />
      )}
      <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)]">
        {aside}
        <main className={cn("min-h-0 min-w-0", !aside && "col-span-2")}>
          {children}
        </main>
      </div>
      {statusbar ? (
        <footer className="flex items-center border-t border-border/60">
          {statusbar}
        </footer>
      ) : (
        <div aria-hidden="true" />
      )}
    </div>
  );
}
