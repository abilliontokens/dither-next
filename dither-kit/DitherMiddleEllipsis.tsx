import type { HTMLAttributes } from "react";

import { cn } from "./lib";

/** Center-ellipsis for identifiers: paths, keys, hashes — keeps both ends
 * where recognition happens. `head`/`tail` are character counts; the full
 * string lands in `title`. Pure text, so it never fights `truncate`.
 * Port of MiddleEllipsis.vue. Pure render — no `"use client"`. */
export interface DitherMiddleEllipsisProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title" | "children"> {
  text?: string;
  head?: number;
  tail?: number;
  /** Publish the full text as the native `title` tooltip. */
  title?: boolean;
  className?: string;
}

export function DitherMiddleEllipsis({
  text = "",
  head = 8,
  tail = 6,
  title = true,
  className,
  ...rest
}: DitherMiddleEllipsisProps) {
  const shown = text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
  return (
    <span {...rest} title={title ? text : undefined} className={cn("inline-block max-w-full align-bottom", className)}>
      {shown}
    </span>
  );
}

export default DitherMiddleEllipsis;
