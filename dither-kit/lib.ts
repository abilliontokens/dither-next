import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind-aware className combiner — local copy so the chart pack is
 * self-contained and portable as a registry. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copy text with the async clipboard where it exists (a secure context and a
 * user gesture), else through the legacy selection path, so a copy action
 * works on plain http, in older engines and in automation: true when the
 * text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // denied, no gesture, or an insecure context: the selection path follows
  }
  if (typeof document === "undefined" || !document.body) return false
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.setAttribute("aria-hidden", "true")
  area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0"
  document.body.appendChild(area)
  area.select()
  let copied: boolean
  try {
    copied = document.execCommand("copy")
  } catch {
    copied = false
  }
  area.remove()
  return copied
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
