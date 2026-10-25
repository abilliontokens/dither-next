"use client";

import { useRef, useState, type HTMLAttributes, type KeyboardEvent } from "react";

import { cn } from "./lib";

/** @-mention autocomplete over a textarea: detection is a regex on the text
 * before the caret (`/@(\w*)$/`), the list anchors to the field (not the
 * caret — no mirror div), Arrow keys pick, Enter/Tab inserts, Escape closes.
 * Selection replaces the @query and leaves the caret after a space.
 * Port of MentionInput.vue (`update:modelValue` → `onChange`, `mention` →
 * `onMention`; fallthrough attrs land on the wrapper, `className` on the
 * textarea, as upstream). One fix: upstream re-runs the detection on every
 * keyup, so the keyup of a key the open list had just consumed undid it — an
 * Arrow pick snapped back to the first option, Escape reopened the list. Here
 * the keyup of a consumed key skips the re-detection; every other keyup and
 * click re-detects exactly as upstream. */
export interface DitherMentionInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  options?: string[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onMention?: (value: string) => void;
  className?: string;
}

function matchesFor(options: string[], query: string): string[] {
  const q = query.toLowerCase();
  return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8);
}

export function DitherMentionInput({
  value,
  options = [],
  placeholder = "Write… use @ to mention",
  rows = 3,
  disabled = false,
  onChange,
  onMention,
  className,
  ...rest
}: DitherMentionInputProps) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const start = useRef(0); // caret index where the @ begins
  const [active, setActive] = useState(0);
  // Key whose keydown the open list handled; its keyup must not re-detect.
  const consumed = useRef<string | null>(null);

  const matches = matchesFor(options, query);

  function syncOpen(): void {
    const node = el.current;
    if (!node) return;
    const caret = node.selectionStart ?? node.value.length;
    const m = node.value.slice(0, caret).match(/@([\w-]*)$/);
    if (m) {
      setQuery(m[1]);
      start.current = caret - m[1].length - 1;
      setActive(0);
      setOpen(matchesFor(options, m[1]).length > 0);
    } else {
      setOpen(false);
    }
  }

  function choose(option: string): void {
    const text = value ?? "";
    const node = el.current;
    const caret = node?.selectionStart ?? text.length;
    const at = start.current;
    const next = `${text.slice(0, at)}@${option} ${text.slice(caret)}`;
    onChange?.(next);
    onMention?.(option);
    setOpen(false);
    requestAnimationFrame(() => {
      if (!node) return;
      const pos = at + option.length + 2;
      node.focus();
      node.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    consumed.current = null;
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((active + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((active - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const pick = matches[active];
      if (!pick) return;
      e.preventDefault();
      choose(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else return;
    consumed.current = e.key;
  }

  return (
    <div {...rest} className="relative">
      <textarea
        ref={el}
        value={value ?? ""}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(
          "min-h-20 w-full resize-y rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-foreground/25 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none",
          className,
        )}
        onChange={(e) => onChange?.(e.currentTarget.value)}
        onKeyUp={(e) => {
          if (consumed.current === e.key) {
            consumed.current = null;
            return;
          }
          syncOpen();
        }}
        onClick={syncOpen}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {matches.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={i === active}
              className={cn(
                "cursor-pointer rounded px-2 py-1.5 text-[12.5px] transition-colors",
                i === active ? "bg-accent/20 text-foreground" : "text-muted-foreground",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseMove={() => setActive(i)}
            >
              {option}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default DitherMentionInput;
