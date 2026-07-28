import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind-aware className combiner — local copy so the chart pack is
 * self-contained and portable as a registry. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Round `n` to `dp` decimal places, returning a number.
 *
 * Hydration safety: every non-integer value computed at render time that
 * reaches an inline `style` object or a CSS custom property MUST be rounded
 * before it hits the DOM. Without it, two failure modes cause a permanent
 * server/client mismatch ("A tree hydrated but some attributes of the server
 * rendered HTML didn't match the client properties"):
 *
 *  1. CSS re-serialisation. The browser parses the SSR inline style and stores
 *     a normalised value — a full-precision float comes back shorter (e.g.
 *     `transition-delay: 219.60901828759916ms` is stored as `219.609ms`, and
 *     the `background` shorthand expands to longhands). React's expected
 *     string then never matches the DOM, so hydration throws.
 *  2. Transcendental drift. `Math.sin`/`cos`/`pow`/`exp` are NOT required by
 *     ECMAScript to be correctly rounded, so Node's libm and Chrome's can
 *     disagree in the last bits. A raw result rendered on the server then
 *     compared on the client mismatches (CSS custom properties pass the value
 *     through unnormalised, so the divergence shows up directly).
 *
 * Rounding to a precision that is visually identical AND identical across
 * engines eliminates both. Keep this — deleting it reintroduces the bug.
 */
export function round(n: number, dp = 3): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** `round(n, dp)` + `"px"` suffix. See {@link round}. */
export const px = (n: number, dp = 3): string => `${round(n, dp)}px`
/** `round(n, dp)` + `"ms"` suffix. See {@link round}. */
export const ms = (n: number, dp = 3): string => `${round(n, dp)}ms`
/** `round(n, dp)` + `"s"` suffix. See {@link round}. */
export const sec = (n: number, dp = 3): string => `${round(n, dp)}s`
/** `round(n, dp)` + `"deg"` suffix. See {@link round}. */
export const deg = (n: number, dp = 2): string => `${round(n, dp)}deg`
/** `round(n, dp)` + `"em"` suffix. See {@link round}. */
export const em = (n: number, dp = 4): string => `${round(n, dp)}em`
