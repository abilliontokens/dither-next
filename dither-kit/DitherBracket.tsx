"use client";

import { cssColor } from "./palette";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

export type BracketMatch = { a: string; b: string; winner?: "a" | "b" };

export interface DitherBracketProps {
  /** rounds[r] is the list of matches in round r, left to right. */
  rounds: BracketMatch[][];
  color?: PixelColor;
  /** Enables picking winners by click. */
  interactive?: boolean;
  className?: string;
  onPick?: (round: number, match: number, side: "a" | "b") => void;
}

/**
 * DitherBracket — knockout bracket: columns of matches with connector rails
 * between rounds. Winners carry the accent; when interactive, clicking a side
 * fires `onPick` and the consumer advances the data. Verbatim port of
 * DitherBracket.vue.
 *
 * `"use client"` because the interactive variant renders click handlers
 * (Vue's dynamic `<component :is="…'button'…">`); a Server Component cannot
 * attach `onClick`. The non-interactive branch renders inert `<div>`s.
 */
export function DitherBracket({
  rounds,
  color = "green",
  interactive = false,
  className,
  onPick,
}: DitherBracketProps) {
  const accent = cssColor(color);

  function sideClass(m: BracketMatch, side: "a" | "b"): string {
    return cn(
      "flex h-7 min-w-0 items-center gap-2 px-2.5 text-left text-[11px] transition-colors",
      m.winner === side
        ? "text-foreground"
        : m.winner
          ? "text-muted-foreground/50 line-through"
          : "text-muted-foreground",
      interactive &&
        !m.winner &&
        "cursor-pointer hover:bg-card/60 hover:text-foreground",
    );
  }

  function renderSide(
    m: BracketMatch,
    side: "a" | "b",
    r: number,
    i: number,
  ) {
    const clickable = interactive && !m.winner;
    const sideClassName = cn(
      sideClass(m, side),
      side === "a" ? "w-full border-b border-border/40" : "w-full",
      CONTROL_BUTTON,
    );
    const inner = (
      <>
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-[1px]"
          style={{ background: m.winner === side ? accent : "var(--border)" }}
        />
        <span className="min-w-0 flex-1 truncate">
          {side === "a" ? m.a : m.b}
        </span>
        {m.winner === side ? (
          <span className="sr-only">winner</span>
        ) : null}
      </>
    );
    if (clickable) {
      return (
        <button
          key={side}
          type="button"
          className={sideClassName}
          onClick={() => onPick?.(r, i, side)}
        >
          {inner}
        </button>
      );
    }
    return (
      <div key={side} className={sideClassName}>
        {inner}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-stretch gap-6 overflow-x-auto font-mono",
        className,
      )}
      role="group"
      aria-label="Tournament bracket"
    >
      {rounds.map((round, r) => (
        <div
          key={r}
          className="flex min-w-36 flex-col justify-around gap-3"
        >
          {round.map((m, i) => (
            <div key={i} className="relative">
              <div className="overflow-hidden rounded-md border border-border/60 bg-background/60">
                {renderSide(m, "a", r, i)}
                {renderSide(m, "b", r, i)}
              </div>
              {r < rounds.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-6 h-px w-6 bg-border/60"
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
