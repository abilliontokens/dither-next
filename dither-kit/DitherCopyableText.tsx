"use client";

import type { ReactNode } from "react";

import { DitherClipboard } from "./DitherClipboard";
import { DitherIcon } from "./DitherIcon";
import { cn } from "./lib";

/** One-tap copy around a piece of text: the value travels through the shared
 * DitherClipboard primitive (live-region announcement included), the trigger
 * is an icon button that flips Copy → Check. The Vue scoped slot `{ copied }`
 * becomes `children` as a node or a render function. Port of CopyableText.vue. */
export interface DitherCopyableTextProps {
  value?: string;
  /** Accessible name of the button before copying. */
  label?: string;
  /** Glyph size in px. */
  size?: number;
  className?: string;
  children?: ReactNode | ((state: { copied: boolean }) => ReactNode);
}

export function DitherCopyableText({
  value = "",
  label = "Copy",
  size = 14,
  className,
  children,
}: DitherCopyableTextProps) {
  return (
    <DitherClipboard value={value}>
      {({ copied }) => (
        <button
          type="button"
          aria-label={copied ? "Copied" : label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border border-border/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
        >
          <DitherIcon name={copied ? "Check" : "Copy"} size={size} />
          {typeof children === "function" ? children({ copied }) : children}
        </button>
      )}
    </DitherClipboard>
  );
}

export default DitherCopyableText;
