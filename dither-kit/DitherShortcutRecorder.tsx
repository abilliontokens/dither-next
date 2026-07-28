"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { CONTROL_BUTTON } from "./control";
import { cn, em } from "./lib";
import { BAYER4, pixelPrefersReducedMotion } from "./pixel";

/**
 * Build a small ordered-dither "tile" data URL once, on the client. A 4×4 grid
 * where cells whose `BAYER4` threshold is below `density` are lit in the accent
 * colour and the rest are transparent. Repeated as a CSS `background-image` it
 * reads as the kit's signature Bayer stipple on a keycap face — a genuine
 * dither texture with zero per-render cost. Canvas is touched only inside the
 * effect (never during render) so SSR is safe.
 */
function bayerTileUrl(density: number, fill: string): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 4;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, 4, 4);
  ctx.fillStyle = fill;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER4[y][x] <= density) ctx.fillRect(x, y, 1, 1);
    }
  }
  return c.toDataURL();
}

/** Canonical modifier tokens the recorder emits, in display order. */
type ModToken = "Mod" | "Ctrl" | "Cmd" | "Alt" | "Shift";

const MOD_ORDER: ModToken[] = ["Mod", "Ctrl", "Cmd", "Alt", "Shift"];

/** Map a raw `KeyboardEvent` into an ordered, canonical chord string such as
 *  `"Mod+Shift+K"`. `Mod` is the platform-primary modifier (⌘ on macOS,
 *  Ctrl elsewhere). Returns `null` for a modifier-only press — those are
 *  rejected so a binding always names a real key. Pure, framework-agnostic. */
function chordFromEvent(e: KeyboardEvent | ReactKeyboardEvent, isMac: boolean): string | null {
  const mods = new Set<ModToken>();
  const primary = isMac ? e.metaKey : e.ctrlKey;
  if (primary) mods.add("Mod");
  // Explicit secondary modifiers (including the "wrong" platform mod so a
  // power user can bind e.g. Cmd on Windows deliberately).
  if (e.ctrlKey && !primary) mods.add("Ctrl");
  if (e.metaKey && !primary) mods.add("Cmd");
  if (e.altKey) mods.add("Alt");
  if (e.shiftKey) mods.add("Shift");

  // Normalise the terminating key. Reject pure modifiers, the Lock keys'
  // noise, and dead keys.
  const raw = e.key;
  if (
    raw === "Meta" ||
    raw === "Control" ||
    raw === "Alt" ||
    raw === "Shift" ||
    raw === "CapsLock" ||
    raw === "Fn" ||
    raw === "FnLock" ||
    raw === "ContextMenu" ||
    raw === "Unidentified" ||
    raw === "Dead" ||
    raw === "Tab" // Tab is the recorder's own "commit" gesture, not a binding
  ) {
    return null;
  }

  let key: string;
  if (raw === " ") key = "Space";
  else if (raw === "Enter") key = "Enter";
  else if (raw === "Escape") key = "Escape";
  else if (raw === "Backspace") key = "Backspace";
  else if (raw === "Delete") key = "Delete";
  else if (raw === "ArrowUp") key = "ArrowUp";
  else if (raw === "ArrowDown") key = "ArrowDown";
  else if (raw === "ArrowLeft") key = "ArrowLeft";
  else if (raw === "ArrowRight") key = "ArrowRight";
  else if (raw === "Home") key = "Home";
  else if (raw === "End") key = "End";
  else if (raw === "PageUp") key = "PageUp";
  else if (raw === "PageDown") key = "PageDown";
  else if (raw.length === 1) key = raw.toUpperCase();
  else key = raw;

  const ordered: string[] = MOD_ORDER.filter((m) => mods.has(m));
  ordered.push(key);
  return ordered.join("+");
}

/** Split a stored chord back into its display tokens. */
function tokenize(chord: string): string[] {
  return chord
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** A single display glyph/label for a chord token, honouring the platform. */
function tokenLabel(token: string, isMac: boolean): string {
  switch (token) {
    case "Mod":
      return isMac ? "⌘" : "Ctrl";
    case "Cmd":
      return "⌘";
    case "Ctrl":
      return isMac ? "⌃" : "Ctrl";
    case "Alt":
      return isMac ? "⌥" : "Alt";
    case "Shift":
      return isMac ? "⇧" : "Shift";
    default:
      return token;
  }
}

export interface DitherShortcutRecorderProps {
  /** Controlled chord, e.g. `"Mod+Shift+K"`. Use `undefined` for uncontrolled. */
  value?: string;
  /** Initial chord when uncontrolled. */
  defaultChord?: string;
  /** Fired with the canonical chord string once a full chord is captured. */
  onChange?: (chord: string) => void;
  /** Already-taken bindings; if the recorded chord matches one, a conflict
   *  badge is shown and `onConflictChange` fires. */
  conflicts?: string[];
  /** Fired when the armed/recorded chord collides with `conflicts`. */
  onConflictChange?: (conflicted: boolean) => void;
  /** Placeholder shown when idle and empty. */
  placeholder?: string;
  /** Accessible label for the field. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * DitherShortcutRecorder — a keyboard-shortcut capture field.
 *
 * Click or focus to arm; the next keydown is captured as a chord (modifiers +
 * one terminating key) and emitted via `onChange` as a canonical string such
 * as `"Mod+Shift+K"`. Modifier-only presses are rejected (a binding must name
 * a key). Each token renders as a dithered keycap chip: a 4×4 Bayer tile is
 * baked once (client-only) and repeated as the chip face, so the keycaps read
 * in the kit's stippled texture rather than flat fills.
 *
 * **Hydration:** the platform modifier is resolved in a mount `useEffect`
 * (`navigator.platform`/`userAgent` is server-unknowable). The first paint
 * assumes the non-Mac glyph (`Ctrl`) so server and client markup match; the
 * effect then swaps in `⌘` on macOS. Resolving platform during render would
 * diverge the SSR HTML and throw a hydration mismatch — it must stay in the
 * effect, exactly like the kit's other `window`/`matchMedia` reads.
 *
 * **State vs ref:** `armed` and `chord` drive rendered DOM (the chip row, the
 * status text, the conflict badge) so they are `useState`. The platform flag
 * is state for the same reason. No render-read refs are used.
 *
 * Accessibility: the field is a `role="button"` toggle (`aria-pressed` = armed)
 * with `aria-describedby` pointing at a live status line. When armed, Tab is
 * suppressed inside the field and the next keydown is intercepted on capture
 * so browser shortcuts do not fire. Escape cancels arming.
 */
export function DitherShortcutRecorder({
  value,
  defaultChord,
  onChange,
  conflicts,
  onConflictChange,
  placeholder = "Click to record shortcut",
  label = "Shortcut recorder",
  disabled = false,
  className,
}: DitherShortcutRecorderProps) {
  const reactId = useId();
  const statusId = `${reactId}-status`;
  const fieldId = `${reactId}-field`;

  // Platform resolved client-side only (hydration-safe). False = non-Mac →
  // renders "Ctrl" on the server and first client paint; effect corrects it.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    const p =
      typeof navigator !== "undefined"
        ? (navigator.platform ?? "") + " " + (navigator.userAgent ?? "")
        : "";
    setIsMac(/mac|iphone|ipad|ipod/i.test(p));
  }, []);

  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultChord ?? "");
  const chord = controlled ? value : internal;

  const [armed, setArmed] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(pixelPrefersReducedMotion());
  }, []);

  // The dithered keycap tile — baked once after mount (canvas is client-only).
  const [tile, setTile] = useState("");
  useEffect(() => {
    setTile(bayerTileUrl(0.62, "currentColor"));
  }, []);

  const conflicted = useMemo(() => {
    if (!chord || !conflicts || conflicts.length === 0) return false;
    return conflicts.some((c) => c.trim() === chord.trim());
  }, [chord, conflicts]);

  useEffect(() => {
    onConflictChange?.(conflicted);
  }, [conflicted, onConflictChange]);

  function commit(next: string): void {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  function arm(): void {
    if (disabled) return;
    setArmed(true);
  }

  function disarm(): void {
    setArmed(false);
  }

  function clear(): void {
    setArmed(false);
    commit("");
  }

  function onFieldKeydown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    // Escape always cancels, whether armed or not.
    if (e.key === "Escape") {
      e.preventDefault();
      disarm();
      return;
    }
    if (!armed) {
      // Enter / Space arm from idle (acts like a button activation).
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        arm();
      }
      return;
    }
    // Armed: swallow every key so the browser does not act on it, then resolve.
    e.preventDefault();
    e.stopPropagation();
    const next = chordFromEvent(e, isMac);
    if (next === null) return; // modifier-only — keep listening.
    commit(next);
    setArmed(false);
  }

  const tokens = chord ? tokenize(chord) : [];

  const statusText = armed
    ? "Recording — press a key chord. Escape to cancel."
    : chord
      ? conflicted
        ? `Bound to ${chord}. This conflicts with an existing binding.`
        : `Bound to ${chord}. Activate to re-record.`
      : "No shortcut bound. Activate to record.";

  return (
    <div className={cn("inline-flex flex-col gap-1.5", className)}>
      <div
        id={fieldId}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-roledescription="shortcut recorder"
        aria-pressed={armed}
        aria-disabled={disabled || undefined}
        aria-label={label}
        aria-describedby={statusId}
        onClick={() => (armed ? disarm() : arm())}
        onFocus={() => {
          if (!armed) arm();
        }}
        onBlur={disarm}
        onKeyDown={onFieldKeydown}
        data-armed={armed}
        className={cn(
          CONTROL_BUTTON,
          "group flex min-h-10 select-none items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-[13px] transition-colors",
          armed
            ? "border-accent/70 ring-2 ring-accent/25"
            : "hover:border-foreground/25 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/20",
          disabled && "pointer-events-none opacity-40",
        )}
        style={!reduced && armed ? { animation: "dither-rec-pulse 1.1s steps(2) infinite" } : undefined}
      >
        {tokens.length === 0 ? (
          <span className="text-muted-foreground/70">{armed ? "Press keys…" : placeholder}</span>
        ) : (
          tokens.map((tok, i) => (
            <span key={`${tok}-${i}`} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-[3px] border border-border/80 bg-muted/40 px-1.5 font-mono text-[11px] leading-none text-foreground",
                  "shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]",
                )}
                style={
                  tile
                    ? ({
                        backgroundImage: `url(${tile})`,
                        backgroundRepeat: "repeat",
                        backgroundSize: em(0.2),
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {tokenLabel(tok, isMac)}
              </span>
              {i < tokens.length - 1 ? (
                <span aria-hidden="true" className="text-muted-foreground">
                  +
                </span>
              ) : null}
            </span>
          ))
        )}

        {chord ? (
          <button
            type="button"
            aria-label="Clear shortcut"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className={cn(
              CONTROL_BUTTON,
              "ml-1 flex size-5 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            ×
          </button>
        ) : null}
      </div>

      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusText}
      </span>

      <style>{`@keyframes dither-rec-pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}50%{box-shadow:0 0 0 2px currentColor}}`}</style>
    </div>
  );
}
