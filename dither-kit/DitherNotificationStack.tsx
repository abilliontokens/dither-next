"use client";

import { useState } from "react";

import { CONTROL_BUTTON } from "./control";
import { cssColor } from "./palette";
import type { PixelColor } from "./pixel";
import { cn, round } from "./lib";
import { usePresence } from "./use-presence";
import styles from "./DitherNotificationStack.module.css";

export type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  time?: string;
  /** Text glyph for the leading icon box; omit for a dithered color dot. */
  icon?: string;
  color?: PixelColor;
};

const CARD = 64;
const GAP = 8;

/** Collapsed silhouettes — one expansion mechanism, three summaries. Verbatim
 *  from NotificationStack.vue. */
const VARIANTS = {
  stack: {
    peek: 10,
    origin: "50% 0%",
    at: (i: number) => `translateY(${i * 10}px) scale(${round(1 - i * 0.04, 3)})`,
  },
  fan: {
    peek: 7,
    origin: "50% 130%",
    at: (i: number) =>
      `translateY(${i * 7}px) rotate(${round((i % 2 ? -1 : 1) * i * 2.2, 2)}deg) scale(${round(1 - i * 0.03, 3)})`,
  },
  condensed: {
    peek: 4,
    origin: "50% 0%",
    at: (i: number) => `translateY(${i * 4}px) scale(${round(1 - i * 0.07, 3)})`,
  },
} as const;
export type NotificationStackVariant = keyof typeof VARIANTS;

/**
 * DitherNotificationStack — compact notification cards that spring from a
 * stacked summary into a readable list on hover, focus or tap. Verbatim port
 * of NotificationStack.vue.
 *
 * Tap pins the list open (`value`/`onChange`); hover and focus expand
 * transiently. Three collapsed silhouettes share one expansion: stack (peeked
 * edges), fan (rotated hand), condensed (tight slivers). Cards fan out on the
 * house bouncy bezier `cubic-bezier(0.2, 1.4, 0.4, 1)` with a per-card stagger;
 * reduced motion snaps (the inline transitions carry `motion-reduce:`).
 */
export interface DitherNotificationStackProps {
  items: NotificationItem[];
  /** Pinned-open state (v-model); hover and focus expand transiently. */
  value?: boolean;
  maxVisible?: number;
  collapsedLabel?: string;
  expandedLabel?: string;
  emptyLabel?: string;
  variant?: NotificationStackVariant;
  color?: PixelColor;
  className?: string;
  onChange?: (expanded: boolean) => void;
  onViewAll?: () => void;
}

export function DitherNotificationStack({
  items,
  value = false,
  maxVisible = 3,
  collapsedLabel = "Notifications",
  expandedLabel = "View all",
  emptyLabel = "All caught up",
  variant = "stack",
  color = "blue",
  className,
  onChange,
  onViewAll,
}: DitherNotificationStackProps) {
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);

  const visible = items.slice(0, Math.max(1, maxVisible));
  const expanded = value || hovering || focused;
  const height =
    visible.length === 0
      ? CARD
      : expanded
        ? visible.length * (CARD + GAP) - GAP
        : CARD + (visible.length - 1) * VARIANTS[variant].peek;

  function cardStyle(i: number): React.CSSProperties {
    return {
      transform: expanded ? `translateY(${i * (CARD + GAP)}px)` : VARIANTS[variant].at(i),
      transformOrigin: expanded ? "50% 0%" : VARIANTS[variant].origin,
      opacity: expanded ? 1 : round(Math.max(0.35, 1 - i * 0.25), 3),
      zIndex: visible.length - i,
      transitionDelay: `${(expanded ? i : visible.length - 1 - i) * 40}ms`,
      transitionTimingFunction: "cubic-bezier(0.2, 1.4, 0.4, 1)",
    };
  }

  const showViewAll = expanded && items.length > 0;
  const viewAllPresent = usePresence(showViewAll, 160);

  return (
    <div
      className={cn("w-72 font-mono select-none", className)}
      role="group"
      aria-label={collapsedLabel}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="flex h-7 items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {collapsedLabel}
          {items.length ? (
            <span className="rounded-full border border-border/60 bg-background/60 px-1.5 text-[9px] tabular-nums">
              {items.length}
            </span>
          ) : null}
        </span>
        {viewAllPresent ? (
          <button
            type="button"
            className={cn(
              CONTROL_BUTTON,
              "rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground",
              showViewAll ? styles.viewAllEnter : styles.viewAllLeave,
            )}
            onClick={() => onViewAll?.()}
          >
            {expandedLabel} →
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-[12px] text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div
          className="relative transition-[height] duration-300 motion-reduce:transition-none"
          style={{ height: `${height}px`, transitionTimingFunction: "cubic-bezier(0.2, 1.4, 0.4, 1)" }}
        >
          {visible.map((item, i) => {
            const sharedClass = cn(
              "absolute inset-x-0 top-0 flex h-16 items-center gap-2.5 overflow-hidden rounded-lg border border-border/60 bg-card px-3 text-left transition-[transform,opacity] duration-300 motion-reduce:transition-none",
              i === 0 ? CONTROL_BUTTON : "",
            );
            const sharedStyle = cardStyle(i);
            const iconColor = cssColor(item.color ?? color);
            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-background/60 text-[13px]"
                  style={{ color: iconColor }}
                >
                  {item.icon ? (
                    item.icon
                  ) : (
                    <span className="size-2 rounded-[2px]" style={{ background: iconColor }} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] text-foreground">{item.title}</span>
                    {item.time ? (
                      <span className="shrink-0 text-[9px] text-muted-foreground/80">{item.time}</span>
                    ) : null}
                  </span>
                  {item.body ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.body}
                    </span>
                  ) : null}
                </span>
              </>
            );
            if (i === 0) {
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-expanded={value}
                  aria-label={collapsedLabel}
                  className={sharedClass}
                  style={sharedStyle}
                  aria-hidden={i > 0 && !expanded ? "true" : undefined}
                  onClick={() => onChange?.(!value)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div
                key={item.id}
                className={sharedClass}
                style={sharedStyle}
                aria-hidden={i > 0 && !expanded ? "true" : undefined}
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
