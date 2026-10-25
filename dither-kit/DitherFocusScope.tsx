"use client";

import { useLayoutEffect, useRef, type HTMLAttributes, type KeyboardEvent } from "react";

import { cn } from "./lib";

/**
 * DitherFocusScope — focus management for overlays and popovers:
 * `autofocus` moves focus into the scope on mount (first focusable, else the
 * scope itself), `trapped` keeps Tab/Shift+Tab cycling inside it, and
 * `restoreFocus` hands focus back to whatever had it before — the a11y
 * contract every modal in this kit already obeys. Port of FocusScope.vue.
 *
 * Lifecycle: Vue's `onMounted` (+ `nextTick` focus) / `onBeforeUnmount` pair
 * collapses into one `useLayoutEffect` — it runs after children commit (the
 * nextTick point) and its cleanup runs before the scope's DOM is removed (the
 * onBeforeUnmount point). `autofocus` is read at mount, `restoreFocus` at
 * unmount, `trapped` per keydown — same as the Vue kit.
 */
export interface DitherFocusScopeProps extends HTMLAttributes<HTMLDivElement> {
  autofocus?: boolean;
  trapped?: boolean;
  restoreFocus?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest("[hidden]") && el.getAttribute("aria-hidden") !== "true",
  );
}

export function DitherFocusScope({
  autofocus = true,
  trapped = true,
  restoreFocus = true,
  className,
  children,
  onKeyDown,
  ...rest
}: DitherFocusScopeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const autofocusRef = useRef(autofocus);
  autofocusRef.current = autofocus;
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (autofocusRef.current) {
      const items = focusables(rootRef.current);
      if (items.length > 0) items[0].focus();
      else rootRef.current?.focus();
    }
    return () => {
      if (restoreFocusRef.current && previous && previous.isConnected) previous.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (!trapped || event.key !== "Tab" || !root) return;
    const items = focusables(root);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active instanceof HTMLElement && root.contains(active);

    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div {...rest} ref={rootRef} tabIndex={-1} className={cn("", className)} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

export default DitherFocusScope;
