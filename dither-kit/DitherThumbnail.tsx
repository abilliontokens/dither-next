import type { AnchorHTMLAttributes, CSSProperties } from "react";

import { cn } from "./lib";

/** A 4x4 Bayer lattice tile: one cell of four lit, offset per row — the same
 * ordered-dither rhythm the canvas engine uses, as a static overlay. */
const VEIL: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cg fill='%23000' fill-opacity='0.5'%3E%3Crect x='0' y='0' width='2' height='2'/%3E%3Crect x='8' y='8' width='2' height='2'/%3E%3C/g%3E%3Cg fill='%23fff' fill-opacity='0.35'%3E%3Crect x='8' y='0' width='2' height='2'/%3E%3Crect x='0' y='8' width='2' height='2'/%3E%3C/g%3E%3C/svg%3E\")",
  mixBlendMode: "overlay",
};

/**
 * DitherThumbnail — the interactive thumbnail: a parent link is the trigger,
 * a masked frame (radius + hairline border + overflow hidden) holds a
 * cover-fit image that rests recessed — 70% opacity under a Bayer dot veil —
 * and on hover the whole thing wakes: the image scales up a touch while
 * fading to full opacity as the veil dissolves. One transition block,
 * interruptible mid-flight, clipped by the frame so the zoom never escapes
 * it. zoom-in cursor announces the affordance before the first pixel moves.
 *
 * Port of Thumbnail.vue. Pure render — no `"use client"`. The scoped
 * `.dither-veil` rule becomes an inline style (the lattice tile + overlay
 * blend) and `motion-reduce:opacity-0` (its reduced-motion hide); the
 * `dither-veil` class stays as the hook. Unknown attrs fall through to the
 * link like the Vue root's.
 */
export interface DitherThumbnailProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> {
  src: string;
  alt: string;
  href: string;
  /** aspect ratio of the frame, width/height — the house default is phi. */
  ratio?: string;
  /** dither veil cell size in css px. */
  veilCell?: number;
  className?: string;
}

export function DitherThumbnail({
  src,
  alt,
  href,
  ratio = "1.618",
  veilCell = 4,
  className,
  style,
  ...rest
}: DitherThumbnailProps) {
  return (
    <a
      {...rest}
      href={href}
      aria-label={alt}
      className={cn(
        "group relative block cursor-zoom-in overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      style={{ aspectRatio: ratio, ...style }}
    >
      <span className="absolute inset-0 block overflow-hidden rounded-[inherit] border border-border/70">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-70 transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] group-hover:opacity-100 motion-reduce:transition-none"
        />
        {/* The recessed veil: the house Bayer lattice as a dot overlay. It is
            what makes the resting state feel sunk into the page rather than
            merely dimmed, and it dissolves as the image wakes. */}
        <span
          aria-hidden="true"
          className="dither-veil pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-0 motion-reduce:transition-none motion-reduce:opacity-0"
          style={{ ...VEIL, backgroundSize: `${veilCell * 4}px ${veilCell * 4}px` }}
        />
      </span>
    </a>
  );
}

export default DitherThumbnail;
