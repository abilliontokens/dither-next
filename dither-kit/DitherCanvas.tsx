import { cn } from "./lib";

export interface DitherCanvasProps {
  pattern?: "dots" | "grid" | "plain";
  /** Pattern pitch in CSS pixels. */
  cell?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DitherCanvas — work-surface backdrop — the dotted or ruled field a
 * dashboard sits on. Pure CSS: the pattern inks with the border token and
 * stays behind content. Verbatim port of DitherCanvas.vue.
 */
export function DitherCanvas({
  pattern = "dots",
  cell = 16,
  className,
  children,
}: DitherCanvasProps) {
  const c = `${cell}px`;

  let layer: React.CSSProperties = {};
  if (pattern === "dots") {
    layer = {
      backgroundImage:
        "radial-gradient(var(--border) 1px, transparent 1px)",
      backgroundSize: `${c} ${c}`,
    };
  } else if (pattern === "grid") {
    layer = {
      backgroundImage:
        "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
      backgroundSize: `${c} ${c}`,
    };
  }

  return (
    <div className={cn("relative min-h-0 overflow-auto bg-background/40", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40" style={layer} />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
