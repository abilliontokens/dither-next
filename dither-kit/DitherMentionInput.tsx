"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { CONTROL } from "./control";
import { cn, px } from "./lib";
import { BAYER4 } from "./pixel";

/** A mention option. `value` is the inserted identifier, `label` the visible
 *  text written into the textarea as `trigger + label`. */
export interface DitherMentionOption {
  value: string;
  label: string;
  /** Optional palette seed for the option's dithered marker. */
  color?: string;
}

export interface DitherMentionInputProps {
  /** Selectable mentions. */
  options: DitherMentionOption[];
  /** Controlled textarea value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Fired whenever the text changes (mention insert or ordinary typing). */
  onChange?: (value: string) => void;
  /** Character that opens the suggestion popup at the caret. */
  trigger?: string;
  /** Placeholder for the textarea. */
  placeholder?: string;
  /** Suffix appended after an inserted mention so the user can keep typing
   *  (default a single space). */
  mentionSuffix?: string;
  /** Accessible label. */
  label?: string;
  /** Rows for the underlying textarea. */
  rows?: number;
  disabled?: boolean;
  className?: string;
}

/** Walk backwards from `caret` to the nearest unbroken `trigger` char. Returns
 *  the trigger index and the query typed after it, or `null` if none. The run
 *  between the trigger and the caret must contain no whitespace and no second
 *  trigger — a mention query is a single token. Pure. */
function findTrigger(
  value: string,
  caret: number,
  trigger: string,
): { start: number; query: string } | null {
  let i = caret;
  while (i > 0) {
    const ch = value[i - 1];
    if (ch === trigger) {
      const query = value.slice(i, caret);
      if (/\s/.test(query) || query.includes(trigger)) return null;
      return { start: i - 1, query };
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Detect a completed `trigger + label` mention token ending exactly at
 *  `caret`, where `label` is a known option label. Used so Backspace removes
 *  the whole mention in one stroke. Pure. */
function mentionEndingAt(
  value: string,
  caret: number,
  trigger: string,
  labels: Set<string>,
): { start: number; end: number } | null {
  let i = caret;
  while (i > 0) {
    const ch = value[i - 1];
    if (ch === trigger) {
      const token = value.slice(i, caret);
      if (labels.has(token)) return { start: i - 1, end: caret };
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/**
 * DitherMentionInput — a textarea with `@`-mention autocomplete.
 *
 * Typing the trigger character (default `@`) opens a suggestion popup anchored
 * to the caret. The caret position is measured with the classic **mirrored-div
 * technique**: a hidden div that mirrors the textarea's box model and text up
 * to the caret hosts a marker span whose bounding rect gives the popup anchor —
 * robust to wrapping, scrolling and font changes where arithmetic would drift.
 *
 * Mentions are inserted as plain `trigger + label` text (no fragile index
 * bookkeeping): a mention is recognised by re-scanning the value, so editing
 * elsewhere never desyncs spans. Backspace at the end of a recognised mention
 * deletes the whole token. The mirror renders recognised mentions with a
 * Bayer-dithered highlight (a 4×4 tile baked once, client-only) and each popup
 * option carries a dithered marker swatch — genuine ordered-dither texture, not
 * flat fills.
 *
 * **State vs ref:** `value`, `open`, `active` and `caret` (the popup anchor)
 * all drive rendered DOM, so they are `useState`. The marker/measurement
 * mirror, the last selection, and the open-query bookkeeping are refs — they
 * are only read inside handlers, never during render.
 *
 * Accessibility: the textarea is `role="combobox"` with `aria-expanded`,
 * `aria-autocomplete="list"`, `aria-controls` and a live `aria-activedescendant`
 * pointing at the active option. Arrows navigate, Enter/Tab insert, Escape
 * closes. Focus rings are preserved on the textarea.
 */
export function DitherMentionInput({
  options,
  value,
  defaultValue = "",
  onChange,
  trigger = "@",
  placeholder = "Type @ to mention…",
  mentionSuffix = " ",
  label = "Mention input",
  rows = 4,
  disabled = false,
  className,
}: DitherMentionInputProps) {
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (i: number) => `${reactId}-opt-${i}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const queryInfoRef = useRef<{ start: number; query: string } | null>(null);

  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const text = controlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [caret, setCaret] = useState<{ x: number; y: number; lineH: number }>({
    x: 0,
    y: 0,
    lineH: 20,
  });

  // Bayer tile baked once for mention highlights + option markers (client-only).
  const [tile, setTile] = useState("");
  useEffect(() => {
    if (typeof document === "undefined") return;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 4, 4);
    ctx.fillStyle = "currentColor";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (BAYER4[y][x] <= 0.6) ctx.fillRect(x, y, 1, 1);
      }
    }
    setTile(c.toDataURL());
  }, []);

  const labelSet = useMemo(() => new Set(options.map((o) => o.label)), [options]);
  const labelToColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.label, o.color ?? "#8ab4f8");
    return m;
  }, [options]);

  const filtered = useMemo(() => {
    const q = queryInfoRef.current?.query.toLowerCase() ?? "";
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, open, text]); // re-filter when popup/query/text changes

  function commit(next: string): void {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  /** Measure the caret's box-relative position via the mirror + marker span. */
  function measureCaret(): { x: number; y: number; lineH: number } | null {
    const ta = taRef.current;
    const mirror = mirrorRef.current;
    const marker = markerRef.current;
    const container = containerRef.current;
    if (!ta || !mirror || !marker || !container) return null;
    const at = ta.selectionStart ?? text.length;
    // Rebuild the mirror: text before the caret + marker + text after. Using a
    // text node + marker keeps wrapping identical to the textarea.
    mirror.textContent = "";
    mirror.appendChild(document.createTextNode(text.slice(0, at)));
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(text.slice(at)));
    // Match the textarea's scroll so wrapped lines line up.
    mirror.scrollTop = ta.scrollTop;
    const m = marker.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return { x: m.left - c.left, y: m.top - c.top, lineH: m.height || 20 };
  }

  function refreshPopup(): void {
    const ta = taRef.current;
    if (!ta) return;
    const at = ta.selectionStart ?? text.length;
    const found = findTrigger(text, at, trigger);
    queryInfoRef.current = found;
    if (!found) {
      setOpen(false);
      return;
    }
    const pos = measureCaret();
    if (pos) setCaret(pos);
    setOpen(true);
    setActive(0);
  }

  function syncAndRefresh(): void {
    // Defer measurement until the DOM has the latest text (after input commit).
    requestAnimationFrame(() => refreshPopup());
  }

  function onInput(e: ReactFormEvent<HTMLTextAreaElement>): void {
    commit(e.currentTarget.value);
    syncAndRefresh();
  }

  function onKeyUp(): void {
    refreshPopup();
  }
  function onClick(): void {
    refreshPopup();
  }
  function onSelect(): void {
    refreshPopup();
  }
  function onScroll(): void {
    if (open) {
      const pos = measureCaret();
      if (pos) setCaret(pos);
    }
  }

  function insertMention(opt: DitherMentionOption): void {
    const ta = taRef.current;
    if (!ta) return;
    const info = queryInfoRef.current;
    const at = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? at;
    const start = info ? info.start : at;
    const inserted = `${trigger}${opt.label}${mentionSuffix}`;
    const next = text.slice(0, start) + inserted + text.slice(end);
    commit(next);
    queryInfoRef.current = null;
    setOpen(false);
    // Place the caret after the inserted suffix on the next frame.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = start + inserted.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function move(dir: number): void {
    setActive((a) => {
      const n = filtered.length;
      if (!n) return a;
      return (a + dir + n) % n;
    });
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const opt = filtered[active];
        if (opt) {
          e.preventDefault();
          insertMention(opt);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    // Backspace at the end of a recognised mention removes the whole token.
    if (e.key === "Backspace") {
      const ta = e.currentTarget;
      if (ta.selectionStart === ta.selectionEnd) {
        const at = ta.selectionStart ?? text.length;
        const m = mentionEndingAt(text, at, trigger, labelSet);
        if (m) {
          e.preventDefault();
          // Include a single trailing space if present, so deletion is clean.
          const end = text[m.end] === " " ? m.end + 1 : m.end;
          const next = text.slice(0, m.start) + text.slice(end);
          commit(next);
          requestAnimationFrame(() => {
            const el = taRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(m.start, m.start);
          });
          setOpen(false);
        }
      }
    }
  }

  function onPaste(): void {
    // Default paste is fine; just re-sync the popup after it lands.
    requestAnimationFrame(() => refreshPopup());
  }

  // Close on outside pointer.
  useEffect(() => {
    if (!open) return;
    function onAway(e: PointerEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onAway);
    return () => document.removeEventListener("pointerdown", onAway);
  }, [open]);

  // Keep aria-activedescendant in range when the filtered list shrinks.
  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1));
  }, [filtered, active]);

  // --- mirror render: highlight recognised mentions with the dither tile -----
  const segments = useMemo(() => {
    const parts: { text: string; mention: boolean }[] = [];
    const re = new RegExp(
      `${trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(${[...labelSet].map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "g",
    );
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index), mention: false });
      parts.push({ text: m[0], mention: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last), mention: false });
    return parts;
  }, [text, trigger, labelSet]);

  // Popup vertical placement: flip above the caret if there is no room below.
  const containerH = containerRef.current?.getBoundingClientRect().height ?? 0;
  const flipUp = open && caret.y + caret.lineH + 220 > containerH && caret.y > 220;

  const highlightStyle = tile
    ? ({
        backgroundImage: `url(${tile})`,
        backgroundSize: "4px 4px",
        backgroundRepeat: "repeat",
        color: "var(--foreground, currentColor)",
      } as React.CSSProperties)
    : ({ backgroundColor: "rgba(138,180,248,0.35)" } as React.CSSProperties);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {/* mirrored div: identical box model, hosts the caret marker and the
            highlighted mention overlay. Sits beneath the transparent textarea. */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={cn(
            CONTROL,
            "pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 font-mono text-[13px] leading-5 text-foreground",
          )}
          style={{ overflow: "hidden" }}
        >
          {segments.length === 0 ? <span> </span> : null}
          {segments.map((s, i) =>
            s.mention ? (
              <span
                key={i}
                className="rounded-[2px] px-0.5"
                style={{ ...highlightStyle, color: labelToColor.get(s.text.slice(trigger.length)) ?? "var(--foreground)" }}
              >
                {s.text}
              </span>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
          <span ref={markerRef} className="inline-block w-0">
            {/* zero-width caret marker — its rect is the popup anchor */}
          </span>
        </div>

        <textarea
          ref={taRef}
          rows={rows}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
          aria-label={label}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          spellCheck={false}
          className={cn(
            CONTROL,
            "relative w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-5 caret-foreground",
            "text-transparent",
          )}
          style={{ minHeight: "5rem" }}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onClick={onClick}
          onSelect={onSelect}
          onScroll={onScroll}
          onPaste={onPaste}
          onBlur={() => {
            // Defer so a click on an option (which blurs the textarea) still lands.
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
      </div>

      {open && filtered.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.32)]",
          )}
          style={{
            left: px(Math.max(0, caret.x)),
            top: flipUp ? undefined : px(caret.y + caret.lineH),
            bottom: flipUp ? px(Math.max(0, containerH - caret.y)) : undefined,
          }}
        >
          {filtered.map((o, i) => (
            <div
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px]",
                i === active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                insertMention(o);
              }}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-[1px]"
                style={
                  tile
                    ? ({
                        backgroundImage: `url(${tile})`,
                        backgroundSize: "3px 3px",
                        backgroundColor: o.color ?? "#8ab4f8",
                      } as React.CSSProperties)
                    : { backgroundColor: o.color ?? "#8ab4f8" }
                }
              />
              <span className="truncate">{o.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
