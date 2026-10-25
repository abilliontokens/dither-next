import { DitherIcon } from "./DitherIcon";
import { DitherLink, type DitherLinkProps } from "./DitherLink";
import { cn } from "./lib";

/** External link: new-tab semantics done right (`target=_blank rel=noreferrer`)
 * plus the ExternalLink glyph after the label — the pattern every outbound
 * link in this kit follows. Port of ExternalLink.vue. Pure render — no
 * `"use client"`. */
export interface DitherExternalLinkProps extends Omit<DitherLinkProps, "external"> {
  /** Glyph size in px. */
  iconSize?: number;
  className?: string;
}

export function DitherExternalLink({ iconSize = 12, className, children, ...rest }: DitherExternalLinkProps) {
  return (
    <DitherLink {...rest} external className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <DitherIcon name="ExternalLink" size={iconSize} className="shrink-0 opacity-70" />
    </DitherLink>
  );
}

export default DitherExternalLink;
