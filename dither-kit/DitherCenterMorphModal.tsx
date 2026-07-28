"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { useFocusTrap } from "./use-focus-trap";
import { useInDom } from "./use-in-dom";
import { usePresence } from "./use-presence";
import styles from "./DitherCenterMorphModal.module.css";

/**
 * DitherCenterMorphModal — full-screen modal that morphs open from a centered
 * clip-path. Verbatim port of CenterMorphModal.vue.
 *
 * The Vue `<Teleport to="body">` + `<Transition name="dk-cmm">` become a
 * `createPortal(..., document.body)` gated on `useInDom()` + `usePresence()`:
 * nothing renders during SSR/prerender, and the node stays mounted for the
 * leave duration (max of the 200ms+220ms backdrop fade and the 400ms panel
 * unfold-reverse = 420ms) before unmounting.
 *
 * Focus management mirrors the Vue kit (and the ported DitherDialog): on open
 * the close button is focused; Tab cycles within the panel via `useFocusTrap`;
 * on close/unmount focus is restored to the trigger. Escape closes (the Vue
 * kit calls `e.stopPropagation()` so an outer dialog's Escape doesn't also
 * fire — preserved).
 *
 * Enter/leave use CSS animations (guide §6), toggled by the `open` class, so
 * the enter plays on mount without the transition-needs-a-prior-value dance.
 */
export interface DitherCenterMorphModalProps {
  open: boolean;
  label?: string;
  closeOnBackdrop?: boolean;
  className?: string;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function DitherCenterMorphModal({
  open,
  label = "Modal",
  closeOnBackdrop = true,
  className,
  onClose,
  children,
}: DitherCenterMorphModalProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const inDom = useInDom();
  // Leave = max(200ms delay + 220ms backdrop fade, 400ms panel unfold-reverse).
  const mounted = usePresence(open, 420);
  useFocusTrap(panelRef, inDom && mounted && open);

  // Focus the close button once the panel is in the DOM (Vue nextTick → rAF).
  useEffect(() => {
    if (!inDom || !mounted || !open) return;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [inDom, mounted, open]);

  function onKeydown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
    }
  }

  function onBackdropPointerDown(e: React.PointerEvent): void {
    if (e.target !== e.currentTarget) return; // `.self` guard
    if (closeOnBackdrop) onClose?.();
  }

  if (!inDom || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        open ? styles.enter : styles.leave,
        "fixed inset-0 z-50 bg-black/65 p-4 sm:p-6",
      )}
      onPointerDown={onBackdropPointerDown}
      onKeyDown={onKeydown}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          styles.panel,
          "relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]",
          className,
        )}
      >
        <button
          ref={closeRef}
          type="button"
          className={cn(
            CONTROL_BUTTON,
            "absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/85 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
          )}
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          ×
        </button>
        <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
