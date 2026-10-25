import type { SVGProps } from "react";

import { ICONS, type IconName } from "./icons";
import { cn } from "./lib";

/**
 * DitherIcon — one glyph from the hand-rolled set: 24×24 stroke geometry in
 * currentColor, sized in px (default 16). A11y follows the icon rule —
 * decorative by default, `label` promotes it to role=img with a name. An
 * unknown name is a loud error (thrown during render), never an empty box.
 * Port of Icon.vue.
 */
export interface DitherIconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "strokeWidth" | "children"> {
  name: IconName;
  size?: number;
  label?: string;
  strokeWidth?: number;
  className?: string;
}

export function DitherIcon({ name, size = 16, label, strokeWidth = 2, className, ...rest }: DitherIconProps) {
  const glyph: readonly string[] | undefined = ICONS[name];
  if (!glyph) throw new Error(`[dither-kit] unknown icon: "${name}"`);
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": "true", focusable: "false" } as const);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
      className={cn("", className)}
    >
      {glyph.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default DitherIcon;
