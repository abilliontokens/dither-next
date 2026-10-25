import type { AnchorHTMLAttributes } from "react";

import { cn } from "./lib";

/** The anchor, dressed: house underline treatment (hairline, grows its
 * offset, brightens on hover) and inheritable color so it sits in prose.
 * `external` opens a new tab with `rel="noreferrer"`. Port of Link.vue. Pure
 * render — no `"use client"`. */
export interface DitherLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  className?: string;
}

export function DitherLink({ href, external = false, className, children, ...rest }: DitherLinkProps) {
  return (
    <a
      {...rest}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/60",
        className,
      )}
    >
      {children}
    </a>
  );
}

export default DitherLink;
