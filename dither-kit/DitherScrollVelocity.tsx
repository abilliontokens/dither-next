"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { useInviewLoop } from "./use-inview-loop";

export interface DitherScrollVelocityProps {
  text?: string;
  baseSpeed?: number;
  className?: string;
}

export function DitherScrollVelocity({
  text = "DITHER · UI · TOOLKIT · ",
  baseSpeed = 60,
  className,
}: DitherScrollVelocityProps) {
  const repeated = useMemo(() => Array.from({ length: 8 }, () => text), [text]);
  const host = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  const x = useRef(0);
  const vel = useRef(0);
  const lastScroll = useRef(0);
  const lastT = useRef(0);
  const half = useRef(0);

  function frame(now: number) {
    raf.current = requestAnimationFrame(frame);
    const node = track.current;
    if (!node) return;
    if (!half.current) half.current = node.scrollWidth / 2 || 1;
    const dt = lastT.current ? Math.min(0.05, (now - lastT.current) / 1000) : 0;
    lastT.current = now;
    x.current -= (baseSpeed + vel.current * 4) * dt;
    vel.current *= 0.9;
    while (x.current <= -half.current) x.current += half.current;
    while (x.current > 0) x.current -= half.current;
    node.style.transform = `translateX(${x.current}px)`;
  }

  function start() {
    if (raf.current || pixelPrefersReducedMotion()) return;
    lastScroll.current = window.scrollY;
    raf.current = requestAnimationFrame(frame);
  }
  function stop() {
    if (!raf.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    vel.current = 0;
  }

  useEffect(() => {
    if (pixelPrefersReducedMotion()) return;
    lastScroll.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      // While the loop is paused (element offscreen) keep the baseline fresh but
      // never accrue velocity — a resume must not fire a stale scroll impulse.
      if (!raf.current) {
        lastScroll.current = y;
        return;
      }
      vel.current += y - lastScroll.current;
      lastScroll.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // baseSpeed changed: hand a running loop the fresh frame closure.
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(frame);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSpeed]);
  useInviewLoop(host, start, stop);

  return (
    <div
      ref={host}
      className={cn("overflow-hidden whitespace-nowrap", className)}
      aria-label={text}
    >
      <div
        ref={track}
        className="inline-flex will-change-transform"
        aria-hidden="true"
      >
        {repeated.map((t, i) => (
          <span key={i} className="pr-6">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
