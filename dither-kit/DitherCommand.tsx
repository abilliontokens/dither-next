"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CONTROL_BUTTON, POPOVER } from "./control";
import { cn } from "./lib";
import { useInDom } from "./use-in-dom";

export type CommandItem = {
  value: string;
  label: string;
  group?: string;
  kbd?: string;
};

export interface DitherCommandProps {
  open: boolean;
  items: CommandItem[];
  placeholder?: string;
  /** Shown when nothing matches. */
  empty?: string;
  className?: string;
  /** `emit("close")` — the studio registry drives this with
   *  `vmodel: { prop: "open", event: "close" }`. */
  onClose?: () => void;
  /** `emit("select", value)` — fired with the chosen command's value. */
  onSelect?: (value: string) => void;
}

/**
 * DitherCommand — command palette. Type to filter, arrows to walk, Enter runs,
 * Escape leaves. Verbatim port of DitherCommand.vue.
 *
 * Same open/close contract as the dialog (guide §6: `<Teleport to="body">` →
 * `createPortal`), so it follows the shipped overlay idiom: the portal is gated
 * on `useInDom()` (false during SSR prerender) before `createPortal(...,
 * document.body)`, exactly like DitherDialog. Unlike the dialog it has no
 * enter/leave transition, so `usePresence` is unnecessary — `open` mounts the
 * portal directly.
 *
 * Group order follows first appearance; ungrouped items fall under `""` (the
 * real contract — reproduced verbatim). Unique ids come from `useId()` (SSR-
 * stable) with colons stripped so the `id`/`aria-controls`/`aria-activedescendant`
 * fragment references stay clean — NOT the Vue kit's module-level counter,
 * which caused a real hydration mismatch before the port.
 */
export function DitherCommand({
  open,
  items,
  placeholder = "Type a command…",
  empty = "No results.",
  className,
  onClose,
  onSelect,
}: DitherCommandProps) {
  const inDom = useInDom();
  // useId is SSR-stable; strip the `:`s React emits so idrefs are clean.
  const reactId = useId();
  const idBase = `dk-command-${reactId.replace(/:/g, "")}`;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? items.filter((i) => i.label.toLowerCase().includes(q))
      : items;
  }, [items, query]);

  /** Group order follows first appearance; ungrouped items fall under "". */
  const groups = useMemo(() => {
    const out = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const g = item.group ?? "";
      if (!out.has(g)) out.set(g, []);
      out.get(g)!.push(item);
    }
    return out;
  }, [filtered]);

  const flat = useMemo(() => {
    const arr: CommandItem[] = [];
    for (const list of groups.values()) arr.push(...list);
    return arr;
  }, [groups]);

  const indexOf = (item: CommandItem): number => flat.indexOf(item);

  // Vue `watch(open)` → effect. On open: snapshot prior focus, reset query/
  // active, focus the input once the portal is in the DOM (setTimeout mirrors
  // `nextTick`). On close: restore focus. Gated on `inDom` so the effect re-
  // runs when the portal first mounts.
  useEffect(() => {
    if (!inDom) return;
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }, [inDom, open]);

  function pick(value: string): void {
    onSelect?.(value);
    onClose?.();
  }

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setQuery(e.target.value);
    // Vue `watch(query, () => (active.value = 0))` — reset on every keystroke.
    setActive(0);
  }

  function onKeydown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
      return;
    }
    const n = flat.length;
    if (!n) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) pick(item.value);
    }
  }

  if (!inDom || !open) return null;

  const activeItem = flat[active];

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center pt-[18vh]"
      onKeyDown={onKeydown}
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={() => onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        className={cn(
          "relative w-[min(92vw,480px)] overflow-hidden font-mono",
          POPOVER,
          className,
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3">
          <span
            className="text-[12px] text-muted-foreground"
            aria-hidden="true"
          >
            ›
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={onQueryChange}
            type="text"
            role="combobox"
            aria-expanded={true}
            aria-controls={`${idBase}-list`}
            aria-activedescendant={
              activeItem ? `${idBase}-${indexOf(activeItem)}` : undefined
            }
            placeholder={placeholder}
            className="h-11 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <span
            className="rounded border border-border/60 px-1 text-[9px] text-muted-foreground"
            aria-hidden="true"
          >
            esc
          </span>
        </div>
        <ul
          id={`${idBase}-list`}
          role="listbox"
          className="max-h-72 overflow-y-auto p-1.5"
        >
          {flat.length === 0 ? (
            <li className="px-2.5 py-6 text-center text-[12px] text-muted-foreground">
              {empty}
            </li>
          ) : null}
          {[...groups.entries()].map(([group, groupItems]) => (
            <Fragment key={group || "top"}>
              {group ? (
                <li
                  aria-hidden="true"
                  className="px-2.5 pt-2 pb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60"
                >
                  {group}
                </li>
              ) : null}
              {groupItems.map((item) => {
                const idx = indexOf(item);
                return (
                  <li
                    id={`${idBase}-${idx}`}
                    key={item.value}
                    role="option"
                    aria-selected={idx === active}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] transition-colors",
                      CONTROL_BUTTON,
                      idx === active
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    )}
                    onClick={() => pick(item.value)}
                    onPointerMove={() => setActive(idx)}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-[1px] bg-current opacity-60"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                    {item.kbd ? (
                      <kbd className="rounded border border-border/60 px-1 text-[9px] tabular-nums text-muted-foreground">
                        {item.kbd}
                      </kbd>
                    ) : null}
                  </li>
                );
              })}
            </Fragment>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
