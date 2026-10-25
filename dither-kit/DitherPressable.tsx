import type { ButtonHTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherPressable — the plainest possible interactive base: a native `button`
 * (type=button so it never submits forms by accident) with the house press
 * affordance — a short scale-down under the finger/Enter key. Focus styling
 * comes from the global `:focus-visible` floor; `disabled` behaves natively.
 * For the dithered, blooming, canvas-filled version see DitherButton.
 * Port of Pressable.vue.
 */
export interface DitherPressableProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export function DitherPressable({
  type = "button",
  disabled = false,
  className,
  children,
  ...rest
}: DitherPressableProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      className={cn("transition-transform active:scale-[0.97]", className)}
    >
      {children}
    </button>
  );
}

export default DitherPressable;
