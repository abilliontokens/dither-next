"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";
import { useInviewLoop } from "./use-inview-loop";
import styles from "./DitherVariableProximity.module.css";

export interface DitherVariableProximityProps {
  text?: string;
  radius?: number;
  className?: string;
}

export function DitherVariableProximity({
  text = "Move the cursor across this line to feel the weight shift",
  radius = 120,
  className,
}: DitherVariableProximityProps) {
  const chars = useMemo(() => [...text], [text]);
  const root = useRef<HTMLSpanElement | null>(null);
  const raf = useRef(0);
  const mx = useRef(-1e9);
  const my = useRef(-1e9);

  function frame() {
    raf.current = requestAnimationFrame(frame);
    const kids = root.current?.children;
    if (!kids) return;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const t = Math.max(0, 1 - Math.hypot(mx.current - cx, my.current - cy) / radius);
      el.style.fontWeight = String(Math.round(300 + t * 600));
      el.style.opacity = String(0.55 + t * 0.45);
    }
  }

  function start() {
    if (raf.current || pixelPrefersReducedMotion()) return;
    raf.current = requestAnimationFrame(frame);
  }
  function stop() {
    if (!raf.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }

  useEffect(() => {
    if (pixelPrefersReducedMotion()) return;

    const onMove = (e: PointerEvent) => {
      mx.current = e.clientX;
      my.current = e.clientY;
    };
    const onLeave = () => {
      mx.current = -1e9;
      my.current = -1e9;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    // `radius` changed: hand a running loop the fresh frame closure.
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(frame);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);
  useInviewLoop(root, start, stop);

  return (
    <span ref={root} className={cn("inline", className)} aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={styles.ditherProximityChar}
          style={{ opacity: 0.55 }}
        >
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </span>
  );
}
