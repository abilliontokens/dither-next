"use client";

import { useEffect, useRef } from "react";

import { cn } from "./lib";

export type ConsoleLevel = "info" | "success" | "warn" | "error";
export type ConsoleLine = { text: string; level?: ConsoleLevel; at?: string };

const LEVEL_VAR: Record<ConsoleLevel, string> = {
  info: "var(--muted-foreground)",
  success: "var(--swatch-green, currentColor)",
  warn: "var(--swatch-orange, currentColor)",
  error: "var(--swatch-red, currentColor)",
};

export interface DitherConsoleProps {
  lines?: (string | ConsoleLine)[];
  title?: string;
  /** Pin the view to the newest line as output arrives. */
  follow?: boolean;
  /** Blinking block caret after the last line (still under reduced motion). */
  caret?: boolean;
  className?: string;
  /** Actions slot (top-right of the toolbar). */
  actions?: React.ReactNode;
}

/**
 * DitherConsole — monospace log surface — level-tinted lines, an optional
 * blinking caret, and follow mode that keeps the newest line in view.
 * Verbatim port of DitherConsole.vue.
 */
export function DitherConsole({
  lines = [],
  title = "console",
  follow = true,
  caret = true,
  className,
  actions,
}: DitherConsoleProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const rows: ConsoleLine[] = lines.map((l) =>
    typeof l === "string" ? { text: l } : l,
  );

  // Follow mode: auto-scroll to the newest line.
  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [rows.length, follow]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/60",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span
          className="size-1.5 rounded-full bg-muted-foreground/50"
          aria-hidden="true"
        />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          {title}
        </span>
        {actions ? (
          <span className="ml-auto flex items-center gap-1.5">
            {actions}
          </span>
        ) : null}
      </div>
      <div
        ref={bodyRef}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
      >
        {rows.length === 0 && (
          <p className="text-muted-foreground/50">No output yet.</p>
        )}
        {rows.map((l, i) => (
          <p key={i} className="flex gap-2 whitespace-pre-wrap">
            {l.at && (
              <span className="shrink-0 text-muted-foreground/40 tabular-nums">
                {l.at}
              </span>
            )}
            <span style={{ color: LEVEL_VAR[l.level ?? "info"] }}>
              {l.text}
            </span>
          </p>
        ))}
        {caret && (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted-foreground/70 motion-reduce:animate-none"
          />
        )}
      </div>
    </div>
  );
}
