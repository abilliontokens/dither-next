"use client";

import { useId, useMemo } from "react";

import { cn, sec } from "./lib";
import styles from "./DitherElectricBorder.module.css";

export interface DitherElectricBorderProps {
  color?: string;
  speed?: number;
  thickness?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherElectricBorder — an animated SVG `feTurbulence` + `feDisplacementMap`
 * filter distorts a solid border overlay into a jittering electric arc. The
 * turbulence `seed` animates via SMIL `<animate>`.
 *
 * React port of ElectricBorder.vue. Uses `useId` for a stable SSR-safe filter
 * id (the Vue version used `Math.random()`, which would mismatch on SSR).
 */
export function DitherElectricBorder({
  color = "#5227FF",
  speed = 1,
  thickness = 2,
  className,
  children,
}: DitherElectricBorderProps) {
  const rawId = useId();
  // useId returns a string with colons (":r0:") which are invalid in CSS
  // url() references and id selectors; sanitize to a safe id.
  const uid = `dither-electric-${rawId.replace(/:/g, "")}`;
  const dur = useMemo(() => sec(2 / Math.max(0.1, speed)), [speed]);

  return (
    <div className={cn("relative inline-block rounded-[12px] px-4 py-2", className)}>
      {/* 0x0 filter host: turbulence displaces the overlay border into an arc */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id={uid} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="3"
              seed="3"
              result="n"
            >
              <animate
                attributeName="seed"
                from="0"
                to="12"
                dur={dur}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={thickness * 3}
            />
          </filter>
        </defs>
      </svg>
      <div
        className={cn(styles.overlay, "pointer-events-none absolute inset-0 rounded-[12px]")}
        style={{
          border: `${thickness}px solid ${color}`,
          filter: `url(#${uid})`,
        }}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
