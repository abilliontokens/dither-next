"use client";

import { useState, type HTMLAttributes } from "react";

import { cn } from "./lib";

const panelClass =
  "grid min-h-32 content-start gap-0.5 overflow-auto rounded-md border border-border bg-background/60 p-1";
const rowClass =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/10 motion-reduce:transition-none";
const btnClass =
  "rounded border border-border/70 px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";

/** Two-panel transfer shuttle: the source pool stays put, the destination IS
 * the model. Native checkboxes select in both directions, Add/Remove move the
 * selection, Add all/Remove all flush. Everything keyboard-reachable.
 * Port of TransferList.vue (`update:modelValue` → `onChange`; fallthrough
 * attrs → `...rest` onto the root). */
export interface DitherTransferListProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  source?: string[];
  value?: string[];
  disabled?: boolean;
  sourceLabel?: string;
  targetLabel?: string;
  onChange?: (value: string[]) => void;
  className?: string;
}

export function DitherTransferList({
  source = [],
  value,
  disabled = false,
  sourceLabel = "Available",
  targetLabel = "Selected",
  onChange,
  className,
  ...rest
}: DitherTransferListProps) {
  const [sourceSel, setSourceSel] = useState<Set<string>>(() => new Set());
  const [targetSel, setTargetSel] = useState<Set<string>>(() => new Set());

  const target = value ?? [];
  const available = source.filter((s) => !target.includes(s));

  function toggle(side: "source" | "target", item: string, checked: boolean) {
    const next = new Set(side === "source" ? sourceSel : targetSel);
    if (checked) next.add(item);
    else next.delete(item);
    (side === "source" ? setSourceSel : setTargetSel)(next);
  }

  function add() {
    onChange?.([...target, ...sourceSel]);
    setSourceSel(new Set());
  }
  function remove() {
    onChange?.(target.filter((t) => !targetSel.has(t)));
    setTargetSel(new Set());
  }
  function addAll() {
    onChange?.([...target, ...available]);
    setSourceSel(new Set());
  }
  function removeAll() {
    onChange?.([]);
    setTargetSel(new Set());
  }

  return (
    <div {...rest} className={cn("grid gap-3 sm:grid-cols-[1fr_auto_1fr]", className)}>
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{sourceLabel}</p>
        <ul className={panelClass} aria-disabled={disabled || undefined}>
          {available.length === 0 ? (
            <li className="px-2 py-1.5 text-[12px] text-muted-foreground">Nothing left</li>
          ) : null}
          {available.map((item) => (
            <li key={item}>
              <label className={rowClass}>
                <input
                  type="checkbox"
                  className="size-3.5 accent-[currentColor]"
                  checked={sourceSel.has(item)}
                  disabled={disabled}
                  onChange={(e) => toggle("source", item, e.currentTarget.checked)}
                />
                {item}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-row justify-center gap-1.5 sm:flex-col sm:justify-center">
        <button type="button" className={btnClass} disabled={disabled || sourceSel.size === 0} onClick={add}>
          Add →
        </button>
        <button type="button" className={btnClass} disabled={disabled || targetSel.size === 0} onClick={remove}>
          ← Remove
        </button>
        <button type="button" className={btnClass} disabled={disabled || available.length === 0} onClick={addAll}>
          Add all
        </button>
        <button type="button" className={btnClass} disabled={disabled || target.length === 0} onClick={removeAll}>
          Remove all
        </button>
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{targetLabel}</p>
        <ul className={panelClass} aria-disabled={disabled || undefined}>
          {target.length === 0 ? <li className="px-2 py-1.5 text-[12px] text-muted-foreground">Empty</li> : null}
          {target.map((item) => (
            <li key={item}>
              <label className={rowClass}>
                <input
                  type="checkbox"
                  className="size-3.5 accent-[currentColor]"
                  checked={targetSel.has(item)}
                  disabled={disabled}
                  onChange={(e) => toggle("target", item, e.currentTarget.checked)}
                />
                {item}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default DitherTransferList;
