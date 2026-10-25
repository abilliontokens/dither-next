"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "./lib";

/**
 * DitherInView — the taxonomy's IntersectionObserver primitive, named for what
 * it does: render-prop visibility. `once` (default) latches after the first
 * enter — the lazy-reveal shape every docs section uses. Without
 * IntersectionObserver the children render as always-in-view, so degraded
 * engines see content instead of an empty box. Port of InView.vue (scoped
 * slot `in-view` → render prop `inView`; `enter`/`leave` emits →
 * `onEnter`/`onLeave`).
 *
 * `rootMargin`/`threshold` are read once when the observer connects on mount,
 * as in the Vue kit; `once` and the callbacks are read live.
 */
export interface DitherInViewProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  className?: string;
  children?: ReactNode | ((state: { inView: boolean }) => ReactNode);
}

export function DitherInView({
  rootMargin = "200px",
  threshold = 0,
  once = true,
  onEnter,
  onLeave,
  className,
  children,
  ...rest
}: DitherInViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // SSR-safe: starts false on server and client alike; the mount effect flips
  // it on engines without IntersectionObserver (Vue initialises it there).
  const [inView, setInView] = useState(false);
  const optionsRef = useRef({ rootMargin, threshold });
  const onceRef = useRef(once);
  onceRef.current = once;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const doneRef = useRef(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const el = rootRef.current;
    if (doneRef.current || !el) return;
    let io: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            onEnterRef.current?.();
            if (onceRef.current) {
              io?.disconnect();
              io = null;
              doneRef.current = true;
            }
          } else if (!onceRef.current && !doneRef.current) {
            setInView(false);
            onLeaveRef.current?.();
          }
        }
      },
      { rootMargin: optionsRef.current.rootMargin, threshold: optionsRef.current.threshold },
    );
    io.observe(el);
    return () => {
      io?.disconnect();
      io = null;
    };
  }, []);

  return (
    <div {...rest} ref={rootRef} className={cn("", className)}>
      {typeof children === "function" ? children({ inView }) : children}
    </div>
  );
}

export default DitherInView;
