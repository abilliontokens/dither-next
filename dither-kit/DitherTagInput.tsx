"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "./lib";
import { rgb } from "./palette";
import { fillOf, fnv1a } from "./pixel";

/** Delimiters that split a pasted blob into multiple tags. */
const SPLIT_RE = /[,;\n\r]+/;

export interface DitherTagInputProps {
  /** Controlled list of committed tags. */
  value: string[];
  onChange?: (tags: string[]) => void;
  /** Autocomplete suggestions shown in a listbox while typing. */
  suggestions?: string[];
  /** Reject duplicate tags when false (the default). */
  duplicates?: boolean;
  /** Hard cap on the number of tags. */
  max?: number;
  /** Per-tag validation; a failed tag is announced, not committed. */
  validate?: (tag: string) => boolean;
  placeholder?: string;
  /** Accessible name for the field. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * DitherTagInput — token/chip input. Type and Enter (or comma) commits a tag;
 * Backspace on an empty field removes the last chip; a delimited paste splits
 * into many. Each chip carries a seeded pixel-square accent: `fnv1a(tag)`
 * picks a hue, `fillOf` resolves it to the kit palette, so every chip reads in
 * the same Bayer-ish colour family as the rest of the kit — deterministic and
 * SSR-stable (no `Math.random`).
 *
 * The autocomplete mirrors `DitherCombobox`'s ARIA exactly: the field is a
 * `role="combobox"` with `aria-autocomplete="list"` / `aria-haspopup="listbox"`
 * / `aria-controls`, the panel is a `role="listbox"`, options are
 * `role="option"` with `aria-selected`, and the field carries
 * `aria-activedescendant` while keyboard-walking the list.
 *
 * Chips are full keyboard citizens: the field and each chip's remove button
 * form one roving ring (ArrowLeft/Right move between them; Backspace/Delete
 * removes). A visually-hidden `role="status"` announces every add/remove and
 * every rejection so screen-reader users hear the chip set change.
 */
export function DitherTagInput({
  value,
  onChange,
  suggestions,
  duplicates = false,
  max,
  validate,
  placeholder = "Add tag…",
  label = "Tags",
  disabled = false,
  className,
}: DitherTagInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chipBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (i: number) => `${reactId}-opt-${i}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [announce, setAnnounce] = useState("");

  const filtered = (() => {
    if (!suggestions || suggestions.length === 0) return [];
    const q = query.trim().toLowerCase();
    const pool = q ? suggestions.filter((s) => s.toLowerCase().includes(q)) : suggestions;
    return pool.filter((s) => duplicates || !value.includes(s));
  })();

  function commit(raw: string): boolean {
    const tag = raw.trim();
    if (!tag) return false;
    if (!duplicates && value.includes(tag)) {
      setAnnounce(`${tag} is already added`);
      return false;
    }
    if (max !== undefined && value.length >= max) {
      setAnnounce(`Maximum of ${max} tags reached`);
      return false;
    }
    if (validate && !validate(tag)) {
      setAnnounce(`${tag} is not a valid tag`);
      return false;
    }
    onChange?.([...value, tag]);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
    setAnnounce(`Added ${tag}. ${value.length + 1} tags`);
    return true;
  }

  function removeAt(i: number): void {
    const removed = value[i];
    if (removed === undefined) return;
    onChange?.(value.filter((_, k) => k !== i));
    setAnnounce(`Removed ${removed}. ${Math.max(0, value.length - 1)} tags`);
    // Preserve position: focus the previous chip button, else the field.
    const prev = chipBtnRefs.current[i - 1];
    if (prev) prev.focus();
    else inputRef.current?.focus();
  }

  function move(dir: number): void {
    const n = filtered.length;
    if (n === 0) return;
    setHighlighted((h) => {
      const start = h < 0 ? (dir > 0 ? -1 : 0) : h;
      return (start + dir + n) % n;
    });
  }

  function onInputKeydown(e: KeyboardEvent<HTMLInputElement>): void {
    const atStart = e.currentTarget.selectionStart === 0;
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlighted >= 0 && filtered[highlighted]) {
        commit(filtered[highlighted]);
      } else {
        commit(query);
      }
      return;
    }
    if (e.key === "," || (e.key === "Tab" && query.trim() && filtered.length === 0)) {
      // Comma always commits; Tab commits only when there is no suggestion to
      // pick (so Tab can still reach a highlighted option via Enter).
      if (e.key === ",") e.preventDefault();
      commit(query);
      return;
    }
    if (e.key === "Backspace" && query === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
      return;
    }
    if (e.key === "ArrowLeft" && atStart && value.length > 0) {
      e.preventDefault();
      chipBtnRefs.current[value.length - 1]?.focus();
      return;
    }
    if (suggestions && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        move(-1);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setHighlighted(-1);
      }
    }
  }

  function onChipKeydown(i: number, e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (i > 0) chipBtnRefs.current[i - 1]?.focus();
      else inputRef.current?.focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      if (i < value.length - 1) chipBtnRefs.current[i + 1]?.focus();
      else inputRef.current?.focus();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      removeAt(i);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>): void {
    const text = e.clipboardData.getData("text");
    if (!SPLIT_RE.test(text)) return; // single token — let it type normally
    e.preventDefault();
    const parts = text.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
    let added = 0;
    for (const p of parts) {
      if (commit(p)) added++;
    }
    if (added === 0) setAnnounce("No valid tags in pasted text");
  }

  // Close the listbox on outside pointer, mirroring DitherSelect's outside guard.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: globalThis.PointerEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    }
    const t = window.setTimeout(
      () => window.addEventListener("pointerdown", onOutside),
      0,
    );
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", onOutside);
    };
  }, [open]);

  const showListbox = open && filtered.length > 0;
  const atMax = max !== undefined && value.length >= max;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[13px] transition-[border-color,box-shadow] motion-reduce:transition-none",
          "hover:border-foreground/25 focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20",
          disabled && "pointer-events-none opacity-40",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => {
          const accent = rgb(fillOf(fnv1a(tag) % 360));
          return (
            <span
              key={`${tag}-${i}`}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-card px-1.5 py-0.5 text-[12px] text-foreground"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0"
                style={{ backgroundColor: accent, imageRendering: "pixelated" }}
              />
              <span className="max-w-[12rem] truncate">{tag}</span>
              <button
                ref={(el) => {
                  chipBtnRefs.current[i] = el;
                }}
                type="button"
                tabIndex={-1}
                aria-label={`Remove ${tag}`}
                disabled={disabled}
                className="-mr-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[1px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                onKeyDown={(e) => onChipKeydown(i, e)}
              >
                ×
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showListbox}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={showListbox ? listboxId : undefined}
          aria-activedescendant={
            showListbox && highlighted >= 0 ? optionId(highlighted) : undefined
          }
          aria-label={label}
          aria-disabled={disabled || atMax || undefined}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ""}
          value={query}
          spellCheck={false}
          autoComplete="off"
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            if (suggestions && suggestions.length) {
              setOpen(true);
              setHighlighted(-1);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onInputKeydown}
          onPaste={onPaste}
          onBlur={() => {
            // Defer so a click on a listbox option can still commit first.
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
      </div>

      {showListbox ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute top-full z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-card p-1"
        >
          {filtered.map((s, i) => (
            <div
              key={s}
              id={optionId(i)}
              role="option"
              aria-selected={value.includes(s)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px]",
                i === highlighted ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
              onPointerEnter={() => setHighlighted(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0"
                style={{ backgroundColor: rgb(fillOf(fnv1a(s) % 360)), imageRendering: "pixelated" }}
              />
              {s}
            </div>
          ))}
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
