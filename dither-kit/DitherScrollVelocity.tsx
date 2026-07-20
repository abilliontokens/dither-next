"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

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
  const track = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  const x = useRef(0);
  const vel = useRef(0);
  const lastScroll = useRef(0);
  const lastT = useRef(0);
  const half = useRef(0);

  useEffect(() => {
    if (pixelPrefersReducedMotion()) return;
    lastScroll.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      vel.current += y - lastScroll.current;
      lastScroll.current = y;
    };

    const frame = (now: number) => {
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
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    raf.current = requestAnimationFrame(frame);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
    };
  }, [baseSpeed]);

  return (
    <div
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
