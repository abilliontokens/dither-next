"use client";

import { useState, type HTMLAttributes, type ReactNode } from "react";

/**
 * DitherHoverArea — hover (and keyboard focus) state as render-prop data — no
 * refs, no manual listeners. Focus is tracked alongside the pointer so
 * keyboard users get the same reveal, which is the whole point of exposing the
 * state at all. `className` and other attrs fall through to the block
 * untouched (passed handlers still fire). Port of HoverArea.vue (scoped slot →
 * render prop; React's bubbling onFocus/onBlur are focusin/focusout).
 */
export interface DitherHoverAreaState {
  hovered: boolean;
  focused: boolean;
}

export interface DitherHoverAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode | ((state: DitherHoverAreaState) => ReactNode);
}

export function DitherHoverArea({
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}: DitherHoverAreaProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div
      {...rest}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        setHovered(false);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setFocused(true);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        setFocused(false);
      }}
    >
      {typeof children === "function" ? children({ hovered, focused }) : children}
    </div>
  );
}

export default DitherHoverArea;
