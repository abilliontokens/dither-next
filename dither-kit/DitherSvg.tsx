import type { SVGProps } from "react";

import { cn } from "./lib";

/**
 * DitherSvg — neutral SVG wrapper: no imposed stroke/fill language — the kit's
 * own art direction stays in the components. A11y follows the icon rule:
 * decorative by default (`aria-hidden`), `label` promotes it to an image with
 * a name. Port of Svg.vue.
 */
export interface DitherSvgProps extends SVGProps<SVGSVGElement> {
  viewBox?: string;
  label?: string;
  className?: string;
}

export function DitherSvg({ viewBox, label, className, children, ...rest }: DitherSvgProps) {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": "true", focusable: "false" } as const);
  return (
    <svg viewBox={viewBox} {...a11y} {...rest} className={cn("", className)}>
      {children}
    </svg>
  );
}

export default DitherSvg;
