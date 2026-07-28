"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "./lib";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import type { ConsoleLevel, ConsoleLine } from "./DitherConsole";
import styles from "./DitherTerminalPrompt.module.css";

/** Level → CSS var, mirroring DitherConsole so the prompt/console pair tint
 *  identically. DitherConsole keeps its own copy local; this stays in sync. */
const LEVEL_COLOR: Record<ConsoleLevel, string> = {
  info: "var(--muted-foreground)",
  success: "var(--swatch-green, currentColor)",
  warn: "var(--swatch-orange, currentColor)",
  error: "var(--swatch-red, currentColor)",
};

export interface DitherTerminalPromptProps {
  /** Past entries rendered as the scrollback (string or level-tinted line). */
  history?: (string | ConsoleLine)[];
  /** Fired with the submitted line (trimmed). The consumer owns `history`. */
  onSubmit?: (line: string) => void;
  /** Inline ghost-text completions; the first that prefixes the draft wins. */
  completions?: string[];
  /** Prompt glyph before the input. */
  prompt?: string;
  placeholder?: string;
  /** Accessible title shown in the header bar. */
  title?: string;
  /** Accent colour for the prompt glyph + echoed entries. */
  color?: PixelColor;
  className?: string;
}

/**
 * DitherTerminalPrompt — the interactive counterpart to the read-only
 * `DitherConsole`. A monospace prompt line with command history
 * (ArrowUp/ArrowDown), inline ghost-text completion (Tab / ArrowRight accepts),
 * and a blinking block caret, rendered over a real `<input>` (not a
 * contenteditable div) so IME composition and screen-reader caret tracking stay
 * correct.
 *
 * The scrollback reuses `DitherConsole`'s types (`ConsoleLine`/`ConsoleLevel`)
 * and its header/log chrome so the pair reads as one family. The custom block
 * caret is measured from a hidden sibling span (same monospace metrics) so it
 * tracks `selectionStart`; while composing (IME) the overlay is unmounted and
 * the native caret returns, the correct behaviour for multistage input.
 *
 * `history` is controlled — the consumer appends on `onSubmit` — so the
 * scrollback and the source of truth are the same array. Reduced motion is read
 * in a mount effect (the caret blink is killed by the CSS module's media query;
 * `still` flattens the follow-scroll easing).
 */
export function DitherTerminalPrompt({
  history = [],
  onSubmit,
  completions,
  prompt = "$",
  placeholder = "type a command…",
  title = "terminal",
  color = "green",
  className,
}: DitherTerminalPromptProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const draftBeforeWalkRef = useRef("");

  const [draft, setDraft] = useState("");
  const [caretPos, setCaretPos] = useState(0);
  const [caretLeft, setCaretLeft] = useState(0);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [histIndex, setHistIndex] = useState(-1);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  const rows: ConsoleLine[] = history.map((l) =>
    typeof l === "string" ? { text: l } : l,
  );

  // Follow mode: pin the scrollback to the newest line as entries arrive.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, [rows.length, still]);

  // Measure the caret offset from a hidden span with identical metrics. Runs
  // after every draft/caret change; cheap (one rect read), no render loop
  // because `caretLeft` is not a dependency.
  useEffect(() => {
    const span = measureRef.current;
    if (!span || composing) return;
    span.textContent = draft.slice(0, caretPos) || "";
    const rect = span.getBoundingClientRect();
    setCaretLeft(rect.width);
  }, [draft, caretPos, composing]);

  function syncCaret(): void {
    const el = inputRef.current;
    if (!el) return;
    setCaretPos(el.selectionStart ?? el.value.length);
  }

  const completion =
    !composing && draft.length > 0
      ? completions?.find((c) => c.startsWith(draft) && c !== draft)
      : undefined;
  const suffix = completion ? completion.slice(draft.length) : "";

  function acceptCompletion(): void {
    if (!suffix) return;
    const next = draft + suffix;
    setDraft(next);
    setCaretPos(next.length);
    setHistIndex(-1);
  }

  function walkHistory(dir: -1 | 1): void {
    if (history.length === 0) return;
    if (histIndex === -1) draftBeforeWalkRef.current = draft;
    let next: number;
    if (dir === -1) {
      // Up: older. From draft, jump to the newest entry.
      next = histIndex === -1 ? history.length - 1 : Math.max(0, histIndex - 1);
    } else {
      // Down: newer. From the oldest, return to the saved draft.
      if (histIndex === -1) return;
      next = histIndex >= history.length - 1 ? -1 : histIndex + 1;
    }
    setHistIndex(next);
    const value =
      next === -1 ? draftBeforeWalkRef.current : String(rows[next]?.text ?? "");
    setDraft(value);
    setCaretPos(value.length);
  }

  function submit(): void {
    const line = draft.trim();
    if (!line || composing) return;
    onSubmit?.(line);
    setDraft("");
    setCaretPos(0);
    setHistIndex(-1);
    inputRef.current?.focus();
  }

  function onKeydown(e: KeyboardEvent<HTMLInputElement>): void {
    if (composing) return; // let IME own the keys
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      walkHistory(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      walkHistory(1);
    } else if (e.key === "Tab" || (e.key === "ArrowRight" && caretPos === draft.length)) {
      if (suffix) {
        e.preventDefault();
        acceptCompletion();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
      setCaretPos(0);
      setHistIndex(-1);
    } else {
      setHistIndex(-1); // any typing exits history walk
    }
  }

  const showCaret = focused && !composing;
  const accent = cssColor(color);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/60",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          {title}
        </span>
      </div>

      <div
        ref={bodyRef}
        role="log"
        aria-live="polite"
        aria-label={`${title} scrollback`}
        className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground/50">No commands yet.</p>
        ) : null}
        {rows.map((l, i) => (
          <p key={i} className="flex gap-1.5 whitespace-pre-wrap">
            <span style={{ color: accent }}>{prompt}</span>
            <span style={{ color: LEVEL_COLOR[l.level ?? "info"] }}>{l.text}</span>
          </p>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border/60 px-3 py-2 font-mono text-[13px]">
        <span aria-hidden="true" style={{ color: accent }}>
          {prompt}
        </span>
        <div className="relative flex-1">
          {/* Hidden measuring span — identical metrics, used to place the caret. */}
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 whitespace-pre font-mono text-[13px]"
            style={{ visibility: "hidden" }}
          />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            aria-label={`${title} command input`}
            aria-autocomplete="inline"
            className="relative w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
            style={{ caretColor: composing ? "auto" : "transparent" }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => {
              setComposing(false);
              syncCaret();
            }}
            onInput={(e) => {
              setDraft(e.currentTarget.value);
              syncCaret();
            }}
            onSelect={syncCaret}
            onClick={syncCaret}
            onKeyUp={syncCaret}
            onKeyDown={onKeydown}
          />
          {/* Ghost-text completion, rendered past the caret. */}
          {completion && !composing ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 whitespace-pre text-muted-foreground/45"
              style={{ left: caretLeft }}
            >
              {suffix}
            </span>
          ) : null}
          {/* Block caret overlay (blink killed by CSS under reduced motion). */}
          {showCaret ? (
            <span
              aria-hidden="true"
              className={cn(
                styles.caret,
                "pointer-events-none absolute top-0 h-[1.1em] w-[0.6em] bg-foreground",
              )}
              style={{ left: caretLeft }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
