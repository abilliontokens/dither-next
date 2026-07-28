"use client";

import {
  Children,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { cssColor } from "./palette";
import { pixelPrefersReducedMotion, type PixelColor } from "./pixel";
import { project, velocityFrom, type VelocitySample } from "./gesture";

export interface DitherCarouselProps {
  /** Slides. Each is wrapped in a `role="group"` with "n of m" labelling. */
  children?: ReactNode;
  /** Controlled active slide index (falls back to internal state). */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Wrap navigation at the ends (buttons/keyboard/autoplay only — drag stops). */
  loop?: boolean;
  /** Auto-advance. Pauses on hover/focus; disabled entirely under reduced motion. */
  autoplay?: boolean;
  /** Autoplay interval in ms. */
  interval?: number;
  /** Pagination-dot accent (kit `PixelColor`). */
  color?: PixelColor;
  /** Accessible name for the carousel region. */
  label?: string;
  className?: string;
}

/**
 * DitherCarousel — snap carousel. A CSS scroll-snap track (one full-width slide
 * per view) with mouse pointer-drag, velocity-projected flick landing, dithered
 * pixel-square pagination, and prev/next controls.
 *
 * The gesture model is the horizontal twin of `DitherWheelPicker`: mouse drags
 * move `scrollLeft` 1:1 (mice have no native momentum), and on release
 * `project(velocityFrom(samples))` (from `./gesture`) decides where the flick
 * lands. Touch is left to native scroll-snap + momentum — the pointer handlers
 * bail unless `pointerType === "mouse"` — exactly as the wheel picker does, so a
 * trackpad swipe still feels native.
 *
 * Keyboard: ArrowLeft/Right move slides, Home/End jump to the bounds. The
 * region is `role="region"` with `aria-roledescription="carousel"`; each slide
 * is a `role="group"` with `aria-roledescription="slide"` and an "n of m"
 * label. Autoplay pauses on hover/focus and is disabled outright when the OS
 * asks for reduced motion (`still`, resolved in a mount effect — never inline).
 */
export function DitherCarousel({
  children,
  index: indexProp,
  onIndexChange,
  loop = false,
  autoplay = false,
  interval = 3500,
  color = "blue",
  label = "Carousel",
  className,
}: DitherCarouselProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const reactId = useId();

  const slides = useMemo(() => Children.toArray(children), [children]);
  const n = slides.length;

  const [internalIndex, setInternalIndex] = useState(0);
  const index = indexProp ?? internalIndex;
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(pixelPrefersReducedMotion());
  }, []);

  // Mirror index into a ref so the autoplay interval and drag handlers read the
  // latest value without a stale closure.
  const indexRef = useRef(index);
  indexRef.current = index;

  function goTo(target: number): void {
    const el = scroller.current;
    if (!el || n === 0) return;
    const slideW = el.clientWidth;
    const j = loop ? ((target % n) + n) % n : Math.max(0, Math.min(n - 1, target));
    el.scrollTo({ left: j * slideW, behavior: still ? "auto" : "smooth" });
    if (j !== indexRef.current) {
      setInternalIndex(j);
      onIndexChange?.(j);
    }
  }

  // Debounced commit from native scroll (wheel/touch/keyboard-smooth).
  const settleRef = useRef(0);
  function commit(): void {
    const el = scroller.current;
    if (!el || draggingRef.current) return;
    const slideW = el.clientWidth;
    const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / slideW)));
    if (i !== indexRef.current) {
      setInternalIndex(i);
      onIndexChange?.(i);
    }
  }
  function onScroll(): void {
    const el = scroller.current;
    if (!el) return;
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(commit, 120);
  }

  // --- mouse drag (mouse only — touch uses native momentum) ----------------
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const samplesRef = useRef<VelocitySample[]>([]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current;
    if (!el) return;
    e.preventDefault();
    el.focus();
    el.setPointerCapture(e.pointerId);
    el.style.scrollSnapType = "none";
    draggingRef.current = true;
    movedRef.current = false;
    samplesRef.current = [{ t: e.timeStamp, p: e.clientX }];
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current) return;
    const el = scroller.current;
    const samples = samplesRef.current;
    const prev = samples[samples.length - 1];
    if (!el || !prev) return;
    if (Math.abs(e.clientX - samples[0].p) > 4) movedRef.current = true;
    el.scrollLeft -= e.clientX - prev.p;
    samples.push({ t: e.timeStamp, p: e.clientX });
    if (samples.length > 6) samples.shift();
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current || e.pointerType !== "mouse") return;
    draggingRef.current = false;
    const el = scroller.current;
    if (!el) return;
    const dest = el.scrollLeft - project(still ? 0 : velocityFrom(samplesRef.current));
    goTo(Math.round(dest / el.clientWidth));
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(commit, 120);
  }

  // External index change → scroll to it (skip first run; mount owns position).
  const valueFirstRef = useRef(true);
  useEffect(() => {
    if (valueFirstRef.current) {
      valueFirstRef.current = false;
      return;
    }
    const el = scroller.current;
    if (el && index !== Math.round(el.scrollLeft / el.clientWidth) && !draggingRef.current) {
      el.scrollTo({ left: index * el.clientWidth, behavior: still ? "auto" : "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Mount: snap to the initial index without animating.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = indexRef.current * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoplay: pause on hover/focus; disabled under reduced motion.
  useEffect(() => {
    if (!autoplay || still || paused || n === 0) return;
    const id = window.setInterval(() => goTo(indexRef.current + 1), interval);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, still, paused, interval, n]);

  // Clear any pending settle timer on unmount.
  useEffect(() => () => window.clearTimeout(settleRef.current), []);

  function onKeydown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      goTo(indexRef.current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      goTo(indexRef.current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(n - 1);
    }
  }

  const accent = cssColor(color);
  const atStart = index <= 0;
  const atEnd = index >= n - 1;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("w-full", className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous slide"
          tabIndex={-1}
          disabled={!loop && atStart}
          onClick={() => goTo(index - 1)}
          className={cn(
            CONTROL_BUTTON,
            "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-background hover:text-foreground",
            !loop && atStart && "pointer-events-none opacity-30",
          )}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div
          ref={scroller}
          tabIndex={0}
          aria-label={`${label} slides`}
          className="flex snap-x snap-mandatory select-none overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onScroll={onScroll}
          onKeyDown={onKeydown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {slides.map((slide, i) => (
            <div
              key={`${reactId}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${n}`}
              className="w-full shrink-0 snap-start"
              onClick={() => {
                if (!movedRef.current) goTo(i);
              }}
            >
              {slide}
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next slide"
          tabIndex={-1}
          disabled={!loop && atEnd}
          onClick={() => goTo(index + 1)}
          className={cn(
            CONTROL_BUTTON,
            "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-background hover:text-foreground",
            !loop && atEnd && "pointer-events-none opacity-30",
          )}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {n > 1 ? (
        <div
          role="group"
          aria-label={`${label} pagination`}
          className="mt-3 flex items-center justify-center gap-1.5"
        >
          {slides.map((_, i) => {
            const active = i === index;
            return (
              <button
                key={i}
                type="button"
                aria-current={active ? "true" : undefined}
                aria-label={`Go to slide ${i + 1}`}
                tabIndex={-1}
                onClick={() => goTo(i)}
                className={cn(
                  "transition-transform motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  active ? "scale-125" : "opacity-50 hover:opacity-80",
                )}
                style={{
                  width: active ? 10 : 6,
                  height: active ? 10 : 6,
                  backgroundColor: active ? accent : "var(--muted-foreground)",
                  imageRendering: "pixelated",
                  borderRadius: 0,
                }}
              />
            );
          })}
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        Slide {index + 1} of {n}
      </span>
    </div>
  );
}
