"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

export interface DitherTextCursorProps {
  text?: string;
  className?: string;
}

/**
 * DitherTextCursor — a trailing cursor of the characters in `text` that
 * follows the pointer with eased lerp. Honors `prefers-reduced-motion` by
 * not starting the RAF loop (chars stay invisible).
 *
 * React port of TextCursor.vue. The per-char transforms/opacity are written
 * imperatively to the DOM inside the RAF loop (no re-render per frame).
 */
export function DitherTextCursor({
  text = "dither",
  className,
}: DitherTextCursorProps) {
  const chars = useMemo(() => [...text], [text]);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const posRef = useRef(chars.map(() => ({ x: 0, y: 0 })));

  useEffect(() => {
    // Re-seed pos to match the current char count.
    posRef.current = chars.map(() => ({ x: 0, y: 0 }));

    if (pixelPrefersReducedMotion()) return;

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame);
      const kids = trailRef.current?.children;
      if (!kids) return;
      const pos = posRef.current;
      const mouse = mouseRef.current;
      let tx = mouse.x;
      let ty = mouse.y;
      for (let i = 0; i < pos.length; i++) {
        pos[i].x += (tx - pos[i].x) * 0.35;
        pos[i].y += (ty - pos[i].y) * 0.35;
        const el = kids[i] as HTMLElement;
        el.style.transform = `translate(${pos[i].x}px, ${pos[i].y}px) translate(-50%, -50%)`;
        el.style.opacity = mouse.active ? String(1 - i / (pos.length + 1)) : "0";
        tx = pos[i].x;
        ty = pos[i].y;
      }
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [chars]);

  return (
    <div
      ref={areaRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      aria-label={text}
      onPointerMove={(e) => {
        const r = areaRef.current?.getBoundingClientRect();
        if (!r) return;
        mouseRef.current.x = e.clientX - r.left;
        mouseRef.current.y = e.clientY - r.top;
        mouseRef.current.active = true;
      }}
      onPointerLeave={() => {
        mouseRef.current.active = false;
      }}
    >
      <div ref={trailRef} aria-hidden="true">
        {chars.map((ch, i) => (
          <span
            key={i}
            className="pointer-events-none absolute left-0 top-0 font-mono transition-opacity duration-200"
            style={{ opacity: 0 }}
          >
            {ch === " " ? "\u00a0" : ch}
          </span>
        ))}
      </div>
    </div>
  );
}
