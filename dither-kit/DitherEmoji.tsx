import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** An emoji as an IMAGE with a real accessible name: `role="img"` +
 * `aria-label` gives screen readers one predictable announcement instead of
 * whatever the glyph's unicode name happens to be. Pass the character, pass
 * what it means here. Port of Emoji.vue. Pure render — no `"use client"`. */
export interface DitherEmojiProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  char?: string;
  label?: string;
  className?: string;
}

export function DitherEmoji({ char = "✨", label = "", className, ...rest }: DitherEmojiProps) {
  return (
    <span {...rest} role="img" aria-label={label || undefined} className={cn("inline-block leading-none", className)}>
      {char}
    </span>
  );
}

export default DitherEmoji;
