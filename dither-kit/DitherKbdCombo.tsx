import { Fragment, type HTMLAttributes } from "react";

import { DitherKbd } from "./DitherKbd";
import { cn } from "./lib";

/** A key combo as one readable unit: `["⌘", "K"]` renders ⌘ + K with the
 * separators Kbd uses — single keys go through DitherKbd directly.
 * Port of KbdCombo.vue. Pure render — no `"use client"`. */
export interface DitherKbdComboProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  keys?: string[];
  separator?: string;
  className?: string;
}

const DEFAULT_KEYS = ["⌘", "K"];

export function DitherKbdCombo({ keys = DEFAULT_KEYS, separator = "+", className, ...rest }: DitherKbdComboProps) {
  const list = keys.filter(Boolean);
  return (
    <span aria-label="Keyboard shortcut" {...rest} className={cn("inline-flex items-center gap-1", className)}>
      {list.map((k, i) => (
        <Fragment key={i}>
          <DitherKbd>{k}</DitherKbd>
          {i < list.length - 1 ? (
            <span className="text-muted-foreground/70" aria-hidden="true">
              {separator}
            </span>
          ) : null}
        </Fragment>
      ))}
    </span>
  );
}

export default DitherKbdCombo;
