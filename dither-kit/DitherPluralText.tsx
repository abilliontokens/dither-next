import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./lib";

/** Intl.PluralRules as a slot switch: the category (zero/one/two/few/many/
 * other) picks the matching prop, `children` is the fallback, and every slot
 * may be a render function receiving `count` so the sentence can place it.
 * Languages with richer plural categories just pass more category props — no
 * conditionals in the caller. Vue's named scoped slots map to one prop per
 * category. Port of PluralText.vue. Pure render — no `"use client"`. */
export type DitherPluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
export type DitherPluralSlot = ReactNode | ((count: number) => ReactNode);

export interface DitherPluralTextProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children">,
    Partial<Record<DitherPluralCategory, DitherPluralSlot>> {
  count?: number;
  locale?: string;
  className?: string;
  /** Fallback when no prop matches the selected category. */
  children?: DitherPluralSlot;
}

function renderSlot(slot: DitherPluralSlot, count: number): ReactNode {
  return typeof slot === "function" ? slot(count) : slot;
}

export function DitherPluralText({
  count = 0,
  locale = "en",
  className,
  children,
  zero,
  one,
  two,
  few,
  many,
  other,
  ...rest
}: DitherPluralTextProps) {
  const slots: Partial<Record<DitherPluralCategory, DitherPluralSlot>> = { zero, one, two, few, many, other };
  const category = new Intl.PluralRules(locale).select(count) as DitherPluralCategory;
  const slot = slots[category];
  return (
    <span {...rest} className={cn(className)}>
      {renderSlot(slot !== undefined ? slot : children, count)}
    </span>
  );
}

export default DitherPluralText;
