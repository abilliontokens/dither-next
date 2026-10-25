"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherClickOutside — calls `onOutside` when a primary pointer press lands
 * anywhere outside the wrapped content (dropdowns, popovers, dismissing
 * scrims). Listens on `pointerdown` in the CAPTURE phase on `document`, so
 * presses inside nested scroll containers (or handlers that stop propagation)
 * still count; `enabled` gates it without tearing down the node.
 * Port of ClickOutside.vue (`emit("outside")` → `onOutside`).
 */
export interface DitherClickOutsideProps extends HTMLAttributes<HTMLDivElement> {
  enabled?: boolean;
  onOutside?: (event: Event) => void;
  className?: string;
}

export function DitherClickOutside({
  enabled = true,
  onOutside,
  className,
  children,
  ...rest
}: DitherClickOutsideProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Latest props in refs: the document listener is attached once per mount.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    function onPointerDown(event: Event): void {
      const root = rootRef.current;
      if (!enabledRef.current || !root) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      onOutsideRef.current?.(event);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return (
    <div {...rest} ref={rootRef} className={cn("", className)}>
      {children}
    </div>
  );
}

export default DitherClickOutside;
