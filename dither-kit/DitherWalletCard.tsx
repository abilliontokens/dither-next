"use client";

import { useEffect, useRef, useState } from "react";

import { CONTROL_BUTTON } from "./control";
import { cssColor } from "./palette";
import type { PixelColor } from "./pixel";
import { cn } from "./lib";
import { usePresence } from "./use-presence";
import styles from "./DitherWalletCard.module.css";

export type WalletAccount = {
  value: string;
  label: string;
  address: string;
  balance: number;
  /** Percent change; sign picks the pill color. */
  change?: number;
  color?: PixelColor;
};
export type WalletAction = "send" | "deposit" | "swap" | "buy";

const ACTIONS: { name: WalletAction; glyph: string; label: string }[] = [
  { name: "send", glyph: "↑", label: "Send" },
  { name: "deposit", glyph: "↓", label: "Deposit" },
  { name: "swap", glyph: "⇄", label: "Swap" },
  { name: "buy", glyph: "+", label: "Buy" },
];
const FMT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MASK = "*******";

/**
 * DitherWalletCard — wallet overview card. Verbatim port of WalletCard.vue.
 *
 * The account switcher and search morph open from their triggers (the search
 * panel lists recent queries), the balance cascades in with a change pill and
 * privacy toggle, the address copies with feedback, a bell carries an unread
 * pulse, and the four actions report through one event. Explicit balance/change
 * props override the active account's numbers.
 *
 * `modelValue` → `value`/`onChange`; the four emits map to `onAction`/
 * `onSearch`/`onSubmit`/`onNotify`. The outside-pointerdown + Escape dismiss
 * is a single effect over `[switching, searching]` that defers listener
 * attachment by a tick (so the opening click doesn't immediately close it) and
 * tears down on close/unmount — the faithful collapse of the Vue
 * `watch([switching, searching])` + `onBeforeUnmount`. The two morph panels
 * use `usePresence` + CSS-animation enter/leave (guide §6).
 */
export interface DitherWalletCardProps {
  accounts: WalletAccount[];
  value?: string;
  /** Override the active account's balance. */
  balance?: number;
  /** Override the active account's change. */
  change?: number;
  currency?: string;
  /** Start with the balance masked. */
  defaultHidden?: boolean;
  searchPlaceholder?: string;
  /** Recent queries listed in the morphed-open search panel. */
  recent?: string[];
  /** Show an unread pulse on the bell. */
  notifications?: boolean;
  color?: PixelColor;
  className?: string;
  onChange?: (value: string) => void;
  onAction?: (name: WalletAction) => void;
  /** Live query text on every keystroke. */
  onSearch?: (query: string) => void;
  /** Committed query — Enter or a recent row. */
  onSubmit?: (query: string) => void;
  onNotify?: () => void;
}

export function DitherWalletCard({
  accounts,
  value,
  balance,
  change: changeOverride,
  currency = "$",
  defaultHidden = false,
  searchPlaceholder = "Search…",
  recent,
  notifications = false,
  color = "green",
  className,
  onChange,
  onAction,
  onSearch,
  onSubmit,
  onNotify,
}: DitherWalletCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const switcherRef = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const [switching, setSwitching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hidden, setHidden] = useState(defaultHidden);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");

  const account = accounts.find((a) => a.value === value) ?? accounts[0];
  const shownBalance = balance ?? account?.balance ?? 0;
  const change = changeOverride ?? account?.change ?? 0;
  const digits = hidden
    ? MASK.split("")
    : `${currency}${FMT.format(shownBalance)}`.split("");
  const changeColor = cssColor(change < 0 ? "red" : "green");
  const addr = account?.address ?? "";
  const shortAddress = addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

  // Outside-pointerdown + Escape dismiss. One effect over [switching, searching]:
  // defer attaching by a tick so the opening click can't immediately close it,
  // and tear down on close/unmount (Vue watch + onBeforeUnmount collapsed).
  useEffect(() => {
    let timer = 0;
    function onOutside(e: PointerEvent): void {
      if (rootRef.current?.contains(e.target as Node)) return;
      setSwitching(false);
      setSearching(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      if (switching) switcherRef.current?.focus();
      setSwitching(false);
      setSearching(false);
    }
    if (switching || searching) {
      timer = window.setTimeout(() => {
        window.addEventListener("pointerdown", onOutside);
        window.addEventListener("keydown", onKey);
      }, 0);
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [switching, searching]);

  // Focus the search input once the morph opens (Vue nextTick → effect).
  useEffect(() => {
    if (searching) searchInput.current?.focus();
  }, [searching]);

  function pick(v: string): void {
    onChange?.(v);
    setSwitching(false);
    switcherRef.current?.focus();
  }

  function submitSearch(q?: string): void {
    const final = q !== undefined ? q : query;
    if (q !== undefined) setQuery(q);
    onSubmit?.(final);
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(account?.address ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const switcherPresent = usePresence(switching, 160);
  const showRecent = searching && !!recent?.length && !query;
  const recentPresent = usePresence(showRecent, 160);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-80 rounded-xl border border-border/70 bg-card/80 p-4 font-mono select-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          ref={switcherRef}
          type="button"
          aria-expanded={switching}
          aria-haspopup="listbox"
          className={cn(
            CONTROL_BUTTON,
            "flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-background",
          )}
          onClick={() => {
            setSwitching((s) => !s);
            setSearching(false);
          }}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: cssColor(account?.color ?? color) }}
          />
          <span className="truncate">{account?.label}</span>
          <span
            aria-hidden="true"
            className={cn(
              "text-[10px] text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              switching ? "rotate-180" : "",
            )}
          >
            ▾
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <div
            className="flex h-8 items-center overflow-hidden rounded-md border border-border/60 bg-background/60 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: searching ? "148px" : "32px" }}
          >
            {!searching ? (
              <button
                type="button"
                aria-label="Search wallet"
                className={cn(
                  CONTROL_BUTTON,
                  "grid size-8 shrink-0 place-items-center text-[13px] text-muted-foreground transition-colors hover:text-foreground",
                )}
                onClick={() => setSearching(true)}
              >
                ⌕
              </button>
            ) : (
              <>
                <span aria-hidden="true" className="pl-2.5 text-[13px] text-muted-foreground">
                  ⌕
                </span>
                <input
                  ref={searchInput}
                  value={query}
                  type="text"
                  aria-label="Search wallet"
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent px-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    onSearch?.(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                  }}
                />
              </>
            )}
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className={cn(
              CONTROL_BUTTON,
              "relative grid size-8 place-items-center rounded-md border border-border/60 bg-background/60 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
            )}
            onClick={() => onNotify?.()}
          >
            ⍾
            {notifications ? (
              <span aria-hidden="true" className="absolute top-1.5 right-1.5 flex size-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
                  style={{ background: cssColor(color) }}
                />
                <span
                  className="relative inline-flex size-1.5 rounded-full"
                  style={{ background: cssColor(color) }}
                />
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {switcherPresent ? (
        <ul
          role="listbox"
          aria-label="Accounts"
          className={cn(
            switching ? styles.morphEnter : styles.morphLeave,
            "absolute top-12 left-4 z-20 min-w-44 origin-top-left rounded-lg border border-border bg-card p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]",
          )}
        >
          {accounts.map((a) => (
            <li key={a.value}>
              <button
                type="button"
                role="option"
                aria-selected={a.value === account?.value}
                className={cn(
                  CONTROL_BUTTON,
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-background/60",
                  a.value === account?.value ? "text-foreground" : "text-muted-foreground",
                )}
                onClick={() => pick(a.value)}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: cssColor(a.color ?? color) }}
                />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                {a.value === account?.value ? <span aria-hidden="true">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {recentPresent ? (
        <div
          className={cn(
            showRecent ? styles.morphEnter : styles.morphLeave,
            "absolute top-12 right-14 z-20 min-w-40 origin-top-right rounded-lg border border-border bg-card p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="px-2.5 pt-1 pb-0.5 text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
            Recent
          </div>
          {recent?.map((r) => (
            <button
              key={r}
              type="button"
              className={cn(
                CONTROL_BUTTON,
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground",
              )}
              onClick={() => submitSearch(r)}
            >
              <span aria-hidden="true" className="text-[11px]">
                ⌕
              </span>
              <span className="min-w-0 flex-1 truncate">{r}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col items-center text-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Balance</span>
          <button
            type="button"
            aria-pressed={hidden}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            className="text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
            onClick={() => setHidden((h) => !h)}
          >
            {hidden ? "◒" : "◉"}
          </button>
        </div>
        <div className="mt-1 flex text-[24px] leading-none text-foreground" aria-live="polite">
          {digits.map((c, i) => (
            <span
              key={`${account?.value}-${hidden}-${i}-${c}`}
              className={cn(styles.digit, "motion-reduce:animate-none")}
              style={{ animationDelay: `${i * 36}ms` }}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex h-6 items-center justify-center">
          {hidden ? (
            <span
              className="translate-y-[2px] text-[12px] leading-none tracking-[0.3em] text-muted-foreground"
              aria-hidden="true"
            >
              *****
            </span>
          ) : (
            <span
              className="relative overflow-hidden rounded-full px-2 py-0.5 text-[10px]"
              style={{ color: changeColor }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 opacity-15"
                style={{ background: changeColor }}
              />
              <span className="relative flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-1 animate-pulse rounded-full motion-reduce:animate-none"
                  style={{ background: changeColor }}
                />
                {change < 0 ? "▼" : "▲"} {Math.abs(change).toFixed(1)}%
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={copied ? "Address copied" : "Copy address"}
          className={cn(
            CONTROL_BUTTON,
            "mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
          )}
          onClick={() => void copy()}
        >
          <span>{shortAddress}</span>
          <span aria-hidden="true" style={copied ? { color: cssColor(color) } : undefined}>
            {copied ? "✓" : "⧉"}
          </span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.name}
            type="button"
            className={cn(
              CONTROL_BUTTON,
              "flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-background/60 py-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
            )}
            onClick={() => onAction?.(a.name)}
          >
            <span aria-hidden="true" className="text-[14px]" style={{ color: cssColor(color) }}>
              {a.glyph}
            </span>
            <span className="text-[10px]">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
