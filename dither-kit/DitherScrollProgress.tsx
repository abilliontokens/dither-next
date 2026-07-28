"use client";

import { useEffect, useRef, useState } from "react";

import { DitherProgress } from "./DitherProgress";
import { cn } from "./lib";
import type { PixelColor } from "./pixel";

/** Reading progress — a dithered bar riding the viewport edge (or the top of
 *  a positioned parent), fed by rAF-throttled scroll. Composes DitherProgress
 *  verbatim. Port of ScrollProgress.vue. */

export interface DitherScrollProgressProps {
  /** "viewport" pins to the window edge; "parent" tracks the nearest scrollable ancestor. */
  attach?: "viewport" | "parent";
  /** Which edge the bar pins to. */
  edge?: "top" | "bottom";
  color?: PixelColor;
  className?: string;
}

export function DitherScrollProgress({
  attach = "viewport",
  edge = "top",
  color = "green",
  className,
}: DitherScrollProgressProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    let scroller: HTMLElement | Window = window;
    let mounted = true;

    if (attach === "parent") {
      let p = rootRef.current?.parentElement ?? null;
      while (p) {
        const o = getComputedStyle(p).overflowY;
        if (o === "auto" || o === "scroll") break;
        p = p.parentElement;
      }
      if (p) scroller = p;
    }

    function measure() {
      rafRef.current = 0;
      let max = 0;
      if (scroller instanceof Window) {
        const doc = document.documentElement;
        max = doc.scrollHeight - doc.clientHeight;
        const pct = max > 0 ? Math.round((doc.scrollTop / max) * 100) : 0;
        if (mounted) setValue(pct);
      } else {
        max = scroller.scrollHeight - scroller.clientHeight;
        const pct = max > 0 ? Math.round((scroller.scrollTop / max) * 100) : 0;
        if (mounted) setValue(pct);
      }
    }

    function onScroll() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(measure);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    measure();

    return () => {
      mounted = false;
      scroller.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [attach]);

  return (
    <div
      ref={rootRef}
      role="presentation"
      className={cn(
        attach === "viewport"
          ? "fixed inset-x-0 z-50"
          : "sticky z-10 -mb-1",
        edge === "bottom" ? "bottom-0" : "top-0",
        className,
      )}
    >
      <DitherProgress
        value={value}
        color={color}
        className="h-1 w-full"
      />
    </div>
  );
}
