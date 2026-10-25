"use client";

import { Fragment, useEffect, useState, type HTMLAttributes } from "react";

import { cn } from "./lib";

export interface DitherCascadeNode {
  value: string;
  children?: DitherCascadeNode[];
}

/** Dependent cascade pickers: a path of native selects where each level's
 * options come from the tree under the current path. Changing a parent
 * truncates the deeper segments (the classic cascade rule). The model is the
 * chosen path — one string per level, deeper entries cleared on change.
 * Port of CascadeSelect.vue (`update:modelValue` → `onChange`; `CascadeNode`
 * exported as `DitherCascadeNode`; `watch(() => props.value)` → `useEffect`
 * on `value`; fallthrough attrs → `...rest` onto the root). */
export interface DitherCascadeSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  tree?: DitherCascadeNode[];
  value?: string[];
  placeholders?: string[];
  disabled?: boolean;
  onChange?: (value: string[]) => void;
  className?: string;
}

export function DitherCascadeSelect({
  tree = [],
  value,
  placeholders = [],
  disabled = false,
  onChange,
  className,
  ...rest
}: DitherCascadeSelectProps) {
  const [path, setPath] = useState<string[]>(() => [...(value ?? [])]);

  useEffect(() => {
    setPath([...(value ?? [])]);
  }, [value]);

  function nodesAt(depth: number): DitherCascadeNode[] {
    let level = tree;
    for (let d = 0; d < depth; d++) {
      const chosen = path[d];
      const node = level.find((n) => n.value === chosen);
      if (!node?.children) return [];
      level = node.children;
    }
    return level;
  }

  let activeDepth = 0;
  while (nodesAt(activeDepth).length > 0 && activeDepth < 12) activeDepth++;

  function handleChange(depth: number, chosen: string) {
    const next = path.slice(0, depth);
    next[depth] = chosen;
    setPath(next);
    onChange?.(next);
  }

  return (
    <div {...rest} className={cn("flex flex-wrap items-center gap-2", className)}>
      {Array.from({ length: activeDepth }, (_, k) => k + 1).map((depth) => (
        <Fragment key={depth}>
          <select
            value={path[depth - 1] ?? ""}
            disabled={disabled}
            aria-label={placeholders[depth - 1] ?? `Level ${depth}`}
            className="min-h-10 rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-foreground/25 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
            onChange={(e) => handleChange(depth - 1, e.currentTarget.value)}
          >
            <option value="" disabled>
              {placeholders[depth - 1] ?? `Level ${depth}`}
            </option>
            {nodesAt(depth - 1).map((node) => (
              <option key={node.value} value={node.value}>
                {node.value}
              </option>
            ))}
          </select>
          {depth < activeDepth ? (
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

export default DitherCascadeSelect;
