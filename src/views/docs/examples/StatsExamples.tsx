"use client";

import { useState } from "react";

import { DitherMeter, Sparkline } from "@dither-kit";

import { DemoCard } from "../DemoCard";

/**
 * StatsExamples — stat-cards + stats-with-charts section pack.
 * Port of `src/pages/docs/examples/StatsExamples.vue`.
 *
 * State mapping (guide §4): `ref<"30d">` → `useState`; `computed(kpis)` →
 * reads the KPIS record by the active period (pure lookup, no memo needed);
 * `good(k)` is a plain helper; `:aria-pressed` → `aria-pressed`; `@click` →
 * `onClick`. The delta chip and the "stats with charts" delta read the palette
 * swatch vars via inline `color`/`borderColor`, matching the Vue source.
 */
type Period = "30d" | "90d";
type Kpi = { label: string; icon: string; value: string; delta: number; note: string };

const PERIODS: Period[] = ["30d", "90d"];

const KPIS: Record<Period, Kpi[]> = {
  "30d": [
    { label: "Revenue", icon: "$", value: "$54,239", delta: 12.5, note: "vs prior 30 days" },
    { label: "Active users", icon: "◩", value: "8,947", delta: 8.2, note: "vs prior 30 days" },
    { label: "Orders", icon: "▤", value: "1,254", delta: 24.1, note: "vs prior 30 days" },
    { label: "Churn", icon: "▽", value: "0.84%", delta: -0.3, note: "vs prior 30 days" },
  ],
  "90d": [
    { label: "Revenue", icon: "$", value: "$148,102", delta: 6.1, note: "vs prior 90 days" },
    { label: "Active users", icon: "◩", value: "9,410", delta: 3.4, note: "vs prior 90 days" },
    { label: "Orders", icon: "▤", value: "3,876", delta: -2.2, note: "vs prior 90 days" },
    { label: "Churn", icon: "▽", value: "1.02%", delta: 0.1, note: "vs prior 90 days" },
  ],
};

/** Churn is inverted — a falling rate is the good direction. */
const good = (k: Kpi) => (k.label === "Churn" ? k.delta < 0 : k.delta > 0);

const TRENDS = {
  revenue: [12, 14, 13, 17, 16, 19, 22, 21, 24, 27, 26, 31],
  sessions: [420, 380, 460, 510, 470, 560, 540, 620, 590, 680, 710, 690],
  latency: [92, 88, 95, 84, 81, 86, 78, 74, 79, 71, 68, 66],
};

const swatchVar = (name: "green" | "red" | "blue") =>
  `var(--swatch-${name})`;

const SNIPPET_CARDS = `<div role="group" aria-label="Period">   {/* period picker */}
  {periods.map(p => (
    <button key={p} aria-pressed={period === p}
      onClick={() => setPeriod(p)}>{p}</button>
  ))}
</div>

<div className="grid grid-cols-4 gap-3">
  {kpis.map(k => (
    <div key={k.label} className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{k.label}</span>
        <span className="grid size-7 place-items-center rounded-md border">{k.icon}</span>
      </div>
      <div className="mt-2 text-xl tabular-nums">{k.value}</div>
      <span style={{ color: good(k) ? 'var(--swatch-green)' : 'var(--swatch-red)' }}>   {/* delta chip */}
        {k.delta > 0 ? '▲' : '▼'} {Math.abs(k.delta)}%
      </span>
      <span>{k.note}</span>
    </div>
  ))}
</div>`;

const SNIPPET_CHARTS = `<div className="grid grid-cols-3 gap-3">
  <div className="rounded-lg border p-4">          {/* sparkline card */}
    <span>MRR</span> <b>$31,204</b>
    <Sparkline data={revenue} color="green" className="h-10" />
  </div>
  <div className="rounded-lg border p-4">
    <span>Sessions</span> <b>690k</b>
    <Sparkline data={sessions} color="blue" variant="dotted" className="h-10" />
  </div>
  <div className="rounded-lg border p-4">          {/* goal card */}
    <span>Q3 target</span> <b>68%</b>
    <DitherMeter value={68} className="h-2 w-full" />
    <span>$34k of $50k booked</span>
  </div>
</div>`;

export function StatsExamples() {
  const [period, setPeriod] = useState<Period>("30d");
  const kpis = KPIS[period];

  return (
    <>
      {/* Stat cards */}
      <section id="stats-cards" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Stat cards</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The classic KPI grid — label, corner glyph, a big tabular number, and a
          signed delta that knows churn falling is good news. The period picker
          swaps the whole dataset live.
        </p>
        <DemoCard code={SNIPPET_CARDS}>
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Overview
              </span>
              <div
                className="flex gap-1 rounded-md border border-border/60 p-0.5"
                role="group"
                aria-label="Period"
              >
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={period === p}
                    className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                      period === p
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpis.map((k) => {
                const tone = good(k) ? "green" : "red";
                return (
                  <div
                    key={k.label}
                    className="rounded-lg border border-border/60 bg-background/40 p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{k.label}</span>
                      <span
                        className="grid size-6 place-items-center rounded-md border border-border/60 text-[11px] text-muted-foreground"
                        aria-hidden="true"
                      >
                        {k.icon}
                      </span>
                    </div>
                    <div className="mt-2 text-[19px] leading-none tracking-tight tabular-nums text-foreground">
                      {k.value}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span
                        className="rounded border px-1 py-px text-[10px] tabular-nums"
                        style={{
                          color: swatchVar(tone),
                          borderColor: `color-mix(in oklab, ${swatchVar(tone)} 35%, transparent)`,
                        }}
                      >
                        <span aria-hidden="true">{k.delta > 0 ? "▲" : "▼"}</span>
                        <span className="sr-only">{k.delta > 0 ? "up" : "down"}</span>
                        {Math.abs(k.delta)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">{k.note}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DemoCard>
      </section>

      {/* Stats with charts */}
      <section id="stats-charts" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Stats with charts</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Numbers with their shape — sparkline cards for trends, a meter card for
          progress toward a goal. Twelve points is plenty; the dither does the
          rest.
        </p>
        <DemoCard code={SNIPPET_CHARTS}>
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">MRR</span>
                <span
                  className="rounded border px-1 py-px text-[10px] tabular-nums"
                  style={{
                    color: swatchVar("green"),
                    borderColor: `color-mix(in oklab, ${swatchVar("green")} 35%, transparent)`,
                  }}
                >
                  ▲ 18.9%
                </span>
              </div>
              <div className="mt-1.5 text-[19px] leading-none tracking-tight tabular-nums text-foreground">
                $31,204
              </div>
              <Sparkline data={TRENDS.revenue} color="green" className="mt-3 h-10" />
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Sessions</span>
                <span
                  className="rounded border px-1 py-px text-[10px] tabular-nums"
                  style={{
                    color: swatchVar("blue"),
                    borderColor: `color-mix(in oklab, ${swatchVar("blue")} 35%, transparent)`,
                  }}
                >
                  ▲ 9.6%
                </span>
              </div>
              <div className="mt-1.5 text-[19px] leading-none tracking-tight tabular-nums text-foreground">
                690k
              </div>
              <Sparkline
                data={TRENDS.sessions}
                color="blue"
                variant="dotted"
                className="mt-3 h-10"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Q3 target</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">68%</span>
              </div>
              <div className="mt-1.5 text-[19px] leading-none tracking-tight tabular-nums text-foreground">
                $34,000
              </div>
              <DitherMeter value={68} className="mt-4 h-2 w-full" />
              <div className="mt-2 text-[10px] text-muted-foreground/70">of $50,000 booked</div>
            </div>
          </div>
        </DemoCard>
      </section>
    </>
  );
}
