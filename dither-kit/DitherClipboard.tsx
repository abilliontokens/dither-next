"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { cn, copyText } from "./lib";

/**
 * DitherClipboard — click-to-copy around any trigger content. A render-prop
 * child gets `{ copied, copy }` so the trigger can render its own feedback,
 * and a polite aria-live region announces the result for screen readers. The
 * child content should be a real control (button/link) — this wrapper adds
 * the clipboard behavior and the announcement, not the semantics.
 * Port of Clipboard.vue (scoped slot → render prop, `emit("copied")` →
 * `onCopied`).
 */
export interface DitherClipboardState {
  copied: boolean;
  copy: () => Promise<void>;
}

export interface DitherClipboardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  value: string;
  disabled?: boolean;
  onCopied?: (value: string) => void;
  children?: ReactNode | ((state: DitherClipboardState) => ReactNode);
}

export function DitherClipboard({
  value,
  disabled = false,
  onCopied,
  children,
  className,
  onClick,
  ...rest
}: DitherClipboardProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function copy(): Promise<void> {
    if (disabled) return;
    if (!(await copyText(value))) {
      setCopied(false);
      return;
    }
    setCopied(true);
    onCopied?.(value);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      {...rest}
      className={cn("contents", className)}
      onClick={(e) => {
        onClick?.(e);
        void copy();
      }}
    >
      {typeof children === "function" ? children({ copied, copy }) : children}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}

export default DitherClipboard;
