import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./lib";

/** Addon slots around a control — prefix/suffix text, icons or buttons in
 * one bordered group. The inner control drops its own chrome (the docs
 * snippet shows the exact class set); the group owns the border and the
 * focus-within ring.
 * Port of InputGroup.vue (named slots `prefix`/`suffix` → `prefix`/`suffix`
 * ReactNode props; default slot → `children`; attrs fall through onto the root
 * div via `...rest`). */
export interface DitherInputGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function DitherInputGroup({ prefix, suffix, children, className, ...rest }: DitherInputGroupProps) {
  return (
    <div
      {...rest}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 transition-[border-color,box-shadow] focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none",
        className,
      )}
    >
      <span className="shrink-0 text-[12px] text-muted-foreground">{prefix}</span>
      {children}
      <span className="shrink-0 text-[12px] text-muted-foreground">{suffix}</span>
    </div>
  );
}

export default DitherInputGroup;
