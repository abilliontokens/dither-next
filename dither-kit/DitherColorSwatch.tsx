"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "./lib";

/** One color as a pickable chip: a real button with the color in its
 * accessible name, selected state ring, keyboard focus ring. Pure display
 * when no `onSelect` listener is wired.
 * Port of ColorSwatch.vue (`emit("select", color)` → `onSelect(color)`; a
 * consumer `onClick`/`style` merge with the swatch's own, as Vue fallthrough
 * attrs do). */
export interface DitherColorSwatchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "type" | "disabled" | "onSelect"> {
  color?: string;
  label?: string;
  selected?: boolean;
  size?: number;
  disabled?: boolean;
  onSelect?: (color: string) => void;
  className?: string;
}

export function DitherColorSwatch({
  color = "#5227FF",
  label,
  selected,
  size = 24,
  disabled = false,
  onSelect,
  className,
  style,
  onClick,
  ...rest
}: DitherColorSwatchProps) {
  const name = label ?? color;
  return (
    <button
      {...rest}
      type="button"
      aria-label={`Select ${name}`}
      aria-pressed={selected}
      disabled={disabled}
      style={{ ...style, background: color, width: `${size}px`, height: `${size}px` }}
      className={cn(
        "rounded-md border border-border/60 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:hover:scale-100",
        selected && "ring-2 ring-accent/70 ring-offset-2 ring-offset-background",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        onSelect?.(color);
      }}
    />
  );
}

export default DitherColorSwatch;
