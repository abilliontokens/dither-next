"use client";

import { cn } from "./lib";
import styles from "./DitherStickerPeel.module.css";

export interface DitherStickerPeelProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherStickerPeel — a dog-ear sticker: the bottom-right corner is a folded
 * flap showing the sticker's lighter underside with a soft curl shadow. On
 * hover the fold grows and the shadow deepens, reading as the corner peeling
 * up. It stays inside the corner (no out-of-bounds rotation), so it never
 * looks like a stray nub.
 *
 * React port of StickerPeel.vue (latest origin/master with the clip-path
 * dog-ear fix from commit 74bc481). Pure CSS; honors `prefers-reduced-motion`.
 */
export function DitherStickerPeel({ className, children }: DitherStickerPeelProps) {
  return (
    <div className={cn("group relative inline-block", className)}>
      <div className="relative z-[1]">{children}</div>
      <div
        className={cn(styles.peel, "pointer-events-none absolute bottom-0 right-0")}
        aria-hidden="true"
      />
    </div>
  );
}
