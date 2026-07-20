"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

const CHARS = "!<>-_\\/[]{}=+*^?#$%&ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface DitherScrambleTextProps {
  text?: string;
  speed?: number;
  className?: string;
}

/**
 * DitherScrambleText — scrambles characters then settles left-to-right on
 * each hover. Honors `prefers-reduced-motion` by doing nothing.
 *
 * React port of ScrambleText.vue.
 */
export function DitherScrambleText({
  text = "Hover to scramble",
  speed = 1,
  className,
}: DitherScrambleTextProps) {
  const [display, setDisplay] = useState(text);

  const rafRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scramble = () => {
    if (pixelPrefersReducedMotion() || runningRef.current) return;
    runningRef.current = true;
    const t = text;
    const settleEvery = Math.max(1, Math.round(2 / Math.max(0.1, speed)));
    const total = t.length * settleEvery + 6;
    let frame = 0;
    const tick = () => {
      frame++;
      const settled = Math.floor(frame / settleEvery);
      let out = "";
      for (let i = 0; i < t.length; i++)
        out += i < settled ? t[i] : t[i] === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)];
      setDisplay(out);
      if (frame < total) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(t);
        runningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <span
      className={cn("inline-block cursor-default whitespace-pre font-mono", className)}
      aria-label={text}
      onMouseEnter={scramble}
    >
      {display}
    </span>
  );
}
