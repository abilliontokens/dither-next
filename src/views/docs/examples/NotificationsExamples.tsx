"use client";

import { useMemo, useState } from "react";

import { DitherAvatar, DitherBadge, DitherTabs } from "@dither-kit";

import { DemoCard } from "../DemoCard";

/**
 * NotificationsExamples — notification-center section pack.
 * Port of `src/pages/docs/examples/NotificationsExamples.vue`.
 *
 * One React component rendering a fragment of sections, matching the Vue
 * `<template>` (which is itself a fragment). Section ids, classes, prose, and
 * the SNIPPET code string are ported from the Vue source; the SNIPPET shows
 * React/TSX usage of the kit — the code tab documents the React API the demo
 * renders.
 *
 * State mapping (guide §4): `reactive<Notice[]>` → one `useState` array
 * updated immutably (map over prev to flip `read`); `ref("All")` → `useState`;
 * `computed(...)` → `useMemo`; `@click="n.read = true"` → `onClick` calling a
 * setter that flips that one notice's `read`; `markAll` mutates every notice
 * → setter that maps the whole array. `DitherTabs v-model` → `value` +
 * `onChange`.
 */
type NoticeColor = "green" | "purple" | "blue" | "orange";
type NoticeDay = "Today" | "Earlier";
type Notice = {
  id: number;
  actor: string;
  color: NoticeColor;
  action: string;
  target: string;
  time: string;
  day: NoticeDay;
  read: boolean;
};

const INITIAL_NOTICES: Notice[] = [
  { id: 1, actor: "Rei Toma", color: "purple", action: "commented on", target: "Palette v3", time: "12m", day: "Today", read: false },
  { id: 2, actor: "Kai Raster", color: "green", action: "assigned you", target: "Export bug #214", time: "1h", day: "Today", read: false },
  { id: 3, actor: "Nia Grid", color: "blue", action: "approved", target: "Q3 budget", time: "3h", day: "Today", read: true },
  { id: 4, actor: "Ivy Pixel", color: "orange", action: "mentioned you in", target: "Launch notes", time: "1d", day: "Earlier", read: false },
  { id: 5, actor: "Sol Bayer", color: "green", action: "merged", target: "dither-kit #98", time: "2d", day: "Earlier", read: true },
  { id: 6, actor: "Juno Bit", color: "blue", action: "invited you to", target: "Print run review", time: "3d", day: "Earlier", read: true },
];

const DAYS: NoticeDay[] = ["Today", "Earlier"];

const SNIPPET = `<div className="w-80 rounded-lg border">
  <header className="flex items-center justify-between border-b p-3">
    Notifications
    {unread ? <DitherBadge color="green">{unread}</DitherBadge> : null}
    <button onClick={markAll}>Mark all read</button>
  </header>

  <DitherTabs tabs={['All', 'Unread']} value={tab} onChange={setTab} variant="segmented" />

  {days.map(day => (
    <section key={day}>
      <h4>{day}</h4>
      {byDay(day).map(n => (
        <button key={n.id} onClick={() => markRead(n.id)}
          className="flex w-full items-start gap-2 p-2 text-left">
          <DitherAvatar name={n.actor} size={24} color={n.color} />
          <span>
            <b>{n.actor}</b> {n.action} <b>{n.target}</b>
            <time>{n.time}</time>
          </span>
          {!n.read && <span className="size-1.5 rounded-full bg-accent" />}  {/* unread dot */}
        </button>
      ))}
    </section>
  ))}

  {!shown.length && <p>All caught up.</p>}   {/* empty state */}
</div>`;

export function NotificationsExamples() {
  const [notices, setNotices] = useState<Notice[]>(INITIAL_NOTICES);
  const [tab, setTab] = useState("All");

  const unreadCount = useMemo(() => notices.filter((n) => !n.read).length, [notices]);
  const shown = useMemo(
    () => (tab === "Unread" ? notices.filter((n) => !n.read) : notices),
    [tab, notices],
  );
  const days = useMemo(
    () => DAYS.filter((d) => shown.some((n) => n.day === d)),
    [shown],
  );
  const byDay = (d: NoticeDay) => shown.filter((n) => n.day === d);

  function markAll() {
    setNotices((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: number) {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <>
      <section id="notification-center" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Notifications</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A notification center — segmented All/Unread tabs, day groups, and an
          unread dot that clears on click or all at once. Empty the unread tab
          and it says so instead of showing nothing.
        </p>
        <DemoCard code={SNIPPET}>
          <div className="mx-auto w-80 rounded-lg border border-border/60 bg-background/40">
            <div className="flex items-center justify-between border-b border-border/60 p-3">
              <span className="flex items-center gap-2 text-[12px] text-foreground">
                Notifications
                {unreadCount ? (
                  <DitherBadge color="green" className="text-[9px]">
                    {unreadCount}
                  </DitherBadge>
                ) : null}
              </span>
              <button
                type="button"
                className="text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                disabled={!unreadCount}
                onClick={markAll}
              >
                Mark all read
              </button>
            </div>
            <div className="px-3 pt-2.5">
              <DitherTabs
                tabs={["All", "Unread"]}
                value={tab}
                onChange={setTab}
                variant="segmented"
                className="text-[11px]"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {days.map((day) => (
                <section key={day} className="mt-1.5 first:mt-0">
                  <h4 className="px-2 pb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
                    {day}
                  </h4>
                  {byDay(day).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-card/60${
                        n.read ? " opacity-70" : ""
                      }`}
                      onClick={() => markRead(n.id)}
                    >
                      <DitherAvatar name={n.actor} size={24} color={n.color} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="text-foreground">{n.actor}</span>{" "}
                        {n.action}{" "}
                        <span className="text-foreground">{n.target}</span>
                        <time className="ml-1 text-[9px] tabular-nums text-muted-foreground/70">
                          {n.time}
                        </time>
                      </span>
                      {!n.read ? (
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                      ) : null}
                      {!n.read ? <span className="sr-only">unread</span> : null}
                    </button>
                  ))}
                </section>
              ))}
              {!shown.length ? (
                <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
                  All caught up.
                </p>
              ) : null}
            </div>
            <div className="border-t border-border/60 p-2">
              <button
                type="button"
                className="w-full rounded-md py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                View archive
              </button>
            </div>
          </div>
        </DemoCard>
      </section>
    </>
  );
}
