"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useInDom } from "./use-in-dom";

/**
 * DitherPortal — teleport by selector: renders its children elsewhere in the
 * DOM (dialogs, popovers, toasts escaping `overflow: hidden`). Defaults to
 * `body`; `disabled` renders in place — the SSR/no-portal switch.
 * Port of Portal.vue (`<Teleport :to :disabled>`).
 *
 * House portal pattern (DitherDialog/DitherToaster): the portal mounts only
 * after `useInDom()` flips true post-hydration, so server renders emit
 * nothing; `to` is resolved with `document.querySelector` after that gate.
 * Like Vue's Teleport, a selector that matches nothing renders nothing.
 */
export interface DitherPortalProps {
  to?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function DitherPortal({ to = "body", disabled = false, children }: DitherPortalProps) {
  const inDom = useInDom();
  if (disabled) return <>{children}</>;
  if (!inDom) return null;
  const target = document.querySelector(to);
  if (!target) return null;
  return createPortal(children, target);
}

export default DitherPortal;
