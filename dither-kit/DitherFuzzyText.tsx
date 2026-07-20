"use client";

import { useId } from "react";

import { cn } from "./lib";
import styles from "./DitherFuzzyText.module.css";

/**
 * DitherFuzzyText — SVG `feTurbulence` + `feDisplacementMap` distortion. A
 * hidden `<defs>` filter (its `baseFrequency` animated via SMIL) displaces the
 * glyphs, giving a living fuzz. `intensity` scales the displacement. Under
 * `prefers-reduced-motion: reduce` the filter is dropped (co-located CSS).
 * `useId` keeps the filter id SSR-stable and unique per instance.
 */
export interface DitherFuzzyTextProps {
  text?: string;
  intensity?: number;
  className?: string;
}

export function DitherFuzzyText({
  text = "FUZZY",
  intensity = 4,
  className,
}: DitherFuzzyTextProps) {
  const rawId = useId();
  const uid = "dither-fuzz-" + rawId.replace(/:/g, "");

  return (
    <span
      className={cn(styles.ditherFuzzy, "relative inline-block", className)}
      aria-label={text}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id={uid} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.4"
              numOctaves={2}
              seed={7}
              result="n"
            >
              <animate
                attributeName="baseFrequency"
                dur="1.6s"
                values="0.012 0.4;0.02 0.55;0.012 0.4"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <span aria-hidden="true" style={{ filter: `url(#${uid})` }}>
        {text}
      </span>
    </span>
  );
}
