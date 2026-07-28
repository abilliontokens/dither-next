"use client";

import { cn } from "./lib";

/** Odometer for live values — each digit rides a 0-9 column that rolls to the
 *  new figure whenever `value` changes. Separators stay put. Reduced motion
 *  snaps columns without the roll. Port of NumberFlow.vue. */

export interface DitherNumberFlowProps {
  value: number;
  decimals?: number;
  /** Roll time per change, ms. */
  duration?: number;
  className?: string;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function DitherNumberFlow({
  value,
  decimals = 0,
  duration = 600,
  className,
}: DitherNumberFlowProps) {
  const chars = value
    .toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .split("");

  return (
    <span
      className={cn("inline-flex tabular-nums", className)}
      aria-live="polite"
    >
      <span className="sr-only">{chars.join("")}</span>
      {chars.map((c, i) => {
        const digit = /\d/.test(c);
        return (
          <span key={`${chars.length}-${i}`}>
            {digit ? (
              <span aria-hidden="true" className="inline-block h-[1em] overflow-hidden">
                <span
                  className="grid transition-transform ease-out motion-reduce:transition-none"
                  style={{
                    transform: `translateY(-${Number(c)}em)`,
                    transitionDuration: `${duration}ms`,
                  }}
                >
                  {DIGITS.map((d) => (
                    <span key={d} className="h-[1em] leading-none">
                      {d}
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              <span aria-hidden="true" className="leading-none">
                {c}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
