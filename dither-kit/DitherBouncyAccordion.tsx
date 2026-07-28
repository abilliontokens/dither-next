"use client";

import { useEffect, useId, useRef } from "react";

import { cssColor } from "./palette";
import { pixelPrefersReducedMotion } from "./pixel";
import type { PixelColor } from "./pixel";
import { cn } from "./lib";

export type BouncyItem = {
  value: string;
  label: string;
  hint?: string;
  /** Text glyph for the leading icon box; omit for a dithered color dot. */
  icon?: string;
  color?: PixelColor;
  content?: string;
};

/** Weighted spring shared by the layout integrator and the CSS content reveal:
 *  mass 1.2, stiffness 240, damping 21 — ~8% overshoot, then calm. Verbatim
 *  from BouncyAccordion.vue. */
const MASS = 1.2;
const STIFFNESS = 240;
const DAMPING = 21;

/** The same spring sampled into a CSS linear() easing for the content rise;
 *  browsers without linear() fall back to the class timing function. */
const SPRING =
  "linear(0, 0.018, 0.0662, 0.1362, 0.221, 0.3143, 0.4111, 0.5073, 0.5997, 0.6858, 0.7642, 0.8336, 0.8938, 0.9445, 0.9862, 1.0193, 1.0445, 1.0627, 1.0748, 1.0816, 1.0842, 1.0832, 1.0796, 1.074, 1.0671, 1.0593, 1.0512, 1.0431, 1.0352, 1.0278, 1.0211, 1.0151, 1.0099, 1.0055, 1.0018, 0.9989, 0.9966, 0.995, 0.9939, 0.9932, 1)";

/** Per-element animation handles. Persists across the module like the Vue
 *  WeakMap. requestAnimationFrame/cancelAnimationFrame/performance.now are only
 *  touched inside `springHeight` (called from effects), never at import. */
const anims = new WeakMap<HTMLElement, number>();

/** Animate height to a px target on the weighted spring (grid 0fr/1fr cannot
 *  overshoot — flex factors clamp at content size — so the layout bounce runs
 *  on real pixels). Rests at `auto` when open so content may keep growing.
 *  Verbatim port of the Vue module-level `springHeight`. */
function springHeight(el: HTMLElement, to: number, openAtRest: boolean): void {
  cancelAnimationFrame(anims.get(el) ?? 0);
  let x = el.offsetHeight;
  let v = 0;
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    const a = (-STIFFNESS * (x - to) - DAMPING * v) / MASS;
    v += a * dt;
    x += v * dt;
    if (Math.abs(x - to) < 0.5 && Math.abs(v) < 5) {
      el.style.height = openAtRest ? "auto" : "0px";
      anims.delete(el);
      return;
    }
    el.style.height = `${Math.max(0, x)}px`;
    anims.set(el, requestAnimationFrame(step));
  };
  anims.set(el, requestAnimationFrame(step));
}

/**
 * DitherBouncyAccordion — single-open accordion with a weighted-spring layout.
 * Verbatim port of BouncyAccordion.vue.
 *
 * Panels overshoot and settle on a damped spring (the integrator above), close
 * briskly, and reveal content with a small rise. `modelValue` → `value`/
 * `onChange`. `still` is read into a ref (only `settle` consumes it, never the
 * render body) so there's no render-time matchMedia access. The Vue
 * `onMounted` + non-immediate `watch(modelValue)` collapse into one effect with
 * a first-run guard: first run = set initial heights (no animation), later
 * runs = settle each panel.
 */
export interface DitherBouncyAccordionProps {
  items: BouncyItem[];
  value?: string;
  color?: PixelColor;
  /** Named-slot content per item: `slots[item.value]` renders in that panel. */
  slots?: Record<string, React.ReactNode>;
  className?: string;
  onChange?: (value: string) => void;
}

export function DitherBouncyAccordion({
  items,
  value = "",
  color = "blue",
  slots,
  className,
  onChange,
}: DitherBouncyAccordionProps) {
  const reactId = useId();
  const id = `dk-bouncy-${reactId}`;
  const stillRef = useRef(false);

  useEffect(() => {
    stillRef.current = pixelPrefersReducedMotion();
  }, []);

  const panelsRef = useRef<(HTMLElement | null)[]>([]);
  const firstRunRef = useRef(true);

  // `onMounted` (set initial heights) + non-immediate `watch(modelValue)`
  // (settle each panel) collapse into one effect. First run = mount: set
  // heights without animating. Later runs = value changed: spring each panel.
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      items.forEach((item, i) => {
        const el = panelsRef.current[i];
        if (el) el.style.height = item.value === value ? "auto" : "0px";
      });
      return;
    }
    items.forEach((item, i) => {
      const el = panelsRef.current[i];
      if (!el) return;
      const open = item.value === value;
      if (stillRef.current) {
        el.style.height = open ? "auto" : "0px";
        return;
      }
      springHeight(el, open ? el.scrollHeight : 0, open);
    });
    // `items` is intentionally excluded to mirror Vue's `watch(modelValue)`
    // (no items watcher). `value` is the sole trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn(className)}>
      {items.map((item, i) => {
        const open = item.value === value;
        return (
          <div key={item.value} className="border-t border-border/40 first:border-t-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${id}-${i}`}
              className="flex w-full items-center gap-3 py-2 text-left text-[13px] text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:outline-none"
              onClick={() => onChange?.(value === item.value ? "" : item.value)}
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-card/60 text-[13px]"
                style={{ color: cssColor(item.color ?? color) }}
              >
                {item.icon ? (
                  item.icon
                ) : (
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: cssColor(item.color ?? color) }}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.hint ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  open ? "rotate-90" : "",
                )}
              >
                ›
              </span>
            </button>
            <div
              id={`${id}-${i}`}
              ref={(el) => {
                panelsRef.current[i] = el;
              }}
              inert={!open}
              className="overflow-hidden"
            >
              <div
                className="pt-1 pb-3 pl-11 text-[13px] leading-relaxed text-muted-foreground transition-[opacity,transform] motion-reduce:transition-none"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : "translateY(-6px)",
                  transitionTimingFunction: open ? SPRING : "cubic-bezier(0.3, 0, 0.2, 1)",
                  transitionDuration: open ? "560ms" : "240ms",
                }}
              >
                {slots?.[item.value] ?? item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
