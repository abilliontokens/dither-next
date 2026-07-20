"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "./lib";
import styles from "./DitherRotatingText.module.css";

export interface DitherRotatingTextProps {
  texts?: string[];
  interval?: number;
  className?: string;
}

/**
 * DitherRotatingText — cycles through a list of strings on a timer, remounting
 * the visible word on each change so its CSS enter animation replays. The
 * container clips overflow so words enter/leave vertically within bounds.
 * Honors `prefers-reduced-motion` via the CSS module.
 *
 * React port of RotatingText.vue. The Vue `<Transition mode="out-in">` leave
 * animation is not reproduced (the old word unmounts instantly); the enter
 * animation is preserved via a remount keyed on the current index.
 */
export function DitherRotatingText({
  texts = ["Vue", "canvas", "dither"],
  interval = 2000,
  className,
}: DitherRotatingTextProps) {
  const list = useMemo(
    () => (texts.length ? texts : [""]),
    [texts],
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const timer = window.setInterval(() => {
      setIdx((i) => (i + 1) % list.length);
    }, Math.max(300, interval));
    return () => clearInterval(timer);
  }, [list, interval]);

  return (
    <span className={cn(styles.ditherRotating, className)}>
      <span key={idx} className={styles.ditherRotWord}>
        {list[idx]}
      </span>
    </span>
  );
}
