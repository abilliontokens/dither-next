import type { SVGProps } from "react";

import { ICON_NAMES, ICONS } from "./icons";

/**
 * DitherIconSet — stamps the whole set as `<symbol>` sheets once (id:
 * `di-icon-<Name>`) for consumers who want `<use href="#di-icon-Name">` instead
 * of repeated inline svgs — one DOM cost for many glyphs. Renders hidden and
 * aria-hidden; mount it once near the app root. `DitherIcon` needs no sprite
 * and works standalone, so this is opt-in, not a prerequisite. `className` and
 * other attrs fall through to the svg. Port of IconSet.vue.
 */
export type DitherIconSetProps = Omit<SVGProps<SVGSVGElement>, "children">;

export function DitherIconSet({ style, ...rest }: DitherIconSetProps) {
  return (
    <svg aria-hidden="true" focusable="false" {...rest} style={{ display: "none", ...style }}>
      {ICON_NAMES.map((name) => (
        <symbol key={name} id={`di-icon-${name}`} viewBox="0 0 24 24" fill="none">
          {ICONS[name].map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </symbol>
      ))}
    </svg>
  );
}

export default DitherIconSet;
