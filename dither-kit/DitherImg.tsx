import type { ImgHTMLAttributes } from "react";

import { cn } from "./lib";

/**
 * DitherImg — plain image primitive with the modern loading contract built in:
 * `loading="lazy"`, `decoding="async"`, and a required `alt` (empty string is
 * the explicit decorative choice — the type will not let you forget it).
 * width/height and anything else fall through to the img untouched.
 * Port of Image.vue (exported upstream as `DitherImg`).
 */
export interface DitherImgProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading" | "decoding" | "children"> {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  className?: string;
}

export function DitherImg({ src, alt, loading = "lazy", decoding = "async", className, ...rest }: DitherImgProps) {
  return <img {...rest} src={src} alt={alt} loading={loading} decoding={decoding} className={cn("", className)} />;
}

export default DitherImg;
