"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "./lib";
import { pixelPrefersReducedMotion } from "./pixel";

const CHARS = "!<>-_\\/[]{}=+*^?#ABCDEF0123456789";

export interface DitherDecryptedTextProps {
  text?: string;
  speed?: number;
  trigger?: "view" | "hover";
  className?: string;
}

/**
 * DitherDecryptedText — scrambles characters then reveals the target text
 * left-to-right. Triggers on view (IntersectionObserver, one-shot) or on
 * hover. Honors `prefers-reduced-motion` by showing the final text.
 *
 * React port of DecryptedText.vue.
 */
export function DitherDecryptedText({
  text = "DECRYPTED",
  speed = 1,
  trigger = "view",
  className,
}: DitherDecryptedTextProps) {
  const elRef = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState("");

  const rafRef = useRef(0);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const runningRef = useRef(false);

  const scramble = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const t = text;
    const revealEvery = Math.max(1, Math.round(3 / Math.max(0.1, speed)));
    const total = t.length * revealEvery + 8;
    let frame = 0;
    const tick = () => {
      frame++;
      const revealed = Math.floor(frame / revealEvery);
      let out = "";
      for (let i = 0; i < t.length; i++)
        out += i < revealed ? t[i] : t[i] === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)];
      setDisplay(out);
      if (frame < total) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(t);
        runningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [text, speed]);

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ioRef.current?.disconnect();
      runningRef.current = false;
    };

    setDisplay(text.replace(/[^ ]/g, "?"));
    if (pixelPrefersReducedMotion()) {
      setDisplay(text);
      return cleanup;
    }
    if (trigger === "hover") {
      setDisplay(text);
      return cleanup;
    }
    if (typeof IntersectionObserver === "undefined") {
      scramble();
      return cleanup;
    }
    const node = elRef.current;
    if (!node) return cleanup;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        scramble();
        io.disconnect();
      }
    });
    ioRef.current = io;
    io.observe(node);
    return cleanup;
  }, [text, trigger, scramble]);

  return (
    <span
      ref={elRef}
      className={cn("inline-block whitespace-pre font-mono", className)}
      aria-label={text}
      onMouseEnter={() => {
        if (trigger === "hover") scramble();
      }}
    >
      {display}
    </span>
  );
}
