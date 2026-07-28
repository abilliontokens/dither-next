"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { project, rubberband, velocityFrom, type VelocitySample } from "./gesture";
import { pixelPrefersReducedMotion } from "./pixel";
import { cn, round } from "./lib";

/** Swipe deck — the top card tracks the pointer 1:1, rubber-bands, and a
 * flick or a far drag sends it flying; the stack rises beneath. Cycles
 * forever. Reduced motion swaps instantly.
 *
 * Port of CardStack.vue (generic `<T>` preserved as a function declaration).
 * Reuses `./gesture` (`project`/`rubberband`/`velocityFrom`) verbatim. `dx` is
 * mirrored to a ref so `up()` reads the freshest displacement for the
 * velocity-projection decision; `dragging`/`flying` are refs for the gesture
 * guards and `dragging` is also state because the top card's transition
 * depends on it. The `0.5 * width` flick threshold, the `1.4 * width` fly
 * distance, and the 200ms fly delay carry across verbatim. */
export interface DitherCardStackProps<T> {
  items: T[];
  /** Visible under-cards. */
  depth?: number;
  className?: string;
  /** Render prop: receives the item, its index, and whether it is the top card. */
  children?: (item: T, index: number, top: boolean) => React.ReactNode;
  onAdvance?: (index: number) => void;
}

export function DitherCardStack<T>({
  items,
  depth = 2,
  className,
  children,
  onAdvance,
}: DitherCardStackProps<T>) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const flyingRef = useRef(false);
  const pointerIdRef = useRef(-1);
  const startXRef = useRef(0);
  const samplesRef = useRef<VelocitySample[]>([]);
  const flyTimerRef = useRef<number>(0);

  const order = useMemo(() => {
    const n = items.length;
    if (!n) return [];
    return Array.from({ length: Math.min(depth + 1, n) }, (_, d) => (index + d) % n);
  }, [items.length, depth, index]);

  function cardStyle(d: number): React.CSSProperties {
    if (d === 0) {
      return {
        transform: `translateX(${dx}px) rotate(${dx / 24}deg)`,
        transition: dragging ? "none" : "transform 200ms ease",
        zIndex: 10,
      };
    }
    return {
      transform: `translateY(${d * 9}px) scale(${round(1 - d * 0.05, 3)})`,
      transition: "transform 200ms ease",
      zIndex: 10 - d,
      opacity: round(1 - d * 0.25, 3),
    };
  }

  function down(e: React.PointerEvent<HTMLDivElement>): void {
    if (flyingRef.current || items.length < 2) return;
    draggingRef.current = true;
    setDragging(true);
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    samplesRef.current = [{ t: e.timeStamp, p: e.clientX }];
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
    const raw = e.clientX - startXRef.current;
    const w = elRef.current?.offsetWidth ?? 300;
    const next =
      Math.abs(raw) > w ? Math.sign(raw) * (w + rubberband(Math.abs(raw) - w, w)) : raw;
    dxRef.current = next;
    setDx(next);
    samplesRef.current.push({ t: e.timeStamp, p: e.clientX });
    if (samplesRef.current.length > 6) samplesRef.current.shift();
  }

  function advance(): void {
    const n = items.length;
    const next = n ? (index + 1) % n : 0;
    flyingRef.current = false;
    dxRef.current = 0;
    setDx(0);
    setIndex(next);
    onAdvance?.(next);
  }

  function up(e: React.PointerEvent<HTMLDivElement>): void {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const w = elRef.current?.offsetWidth ?? 300;
    const v = velocityFrom(samplesRef.current);
    const destination = dxRef.current + project(v);
    if (Math.abs(destination) > w * 0.5) {
      if (pixelPrefersReducedMotion()) {
        advance();
        return;
      }
      flyingRef.current = true;
      const fly = Math.sign(destination) * w * 1.4;
      dxRef.current = fly;
      setDx(fly);
      clearTimeout(flyTimerRef.current);
      flyTimerRef.current = window.setTimeout(advance, 200);
    } else {
      dxRef.current = 0;
      setDx(0);
    }
  }

  // onBeforeUnmount(clearTimeout) → single effect.
  useEffect(() => {
    return () => {
      clearTimeout(flyTimerRef.current);
    };
  }, []);

  return (
    <div ref={elRef} className={cn("relative isolate select-none", className)}>
      {order.map((itemIndex, d) => (
        <div
          key={itemIndex}
          className={cn(
            "absolute inset-0 motion-reduce:!transition-none",
            d === 0 ? "cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none",
          )}
          style={cardStyle(d)}
          aria-hidden={d !== 0}
          role={d === 0 ? "group" : undefined}
          aria-roledescription={d === 0 ? "swipeable card" : undefined}
          aria-label={d === 0 ? `Card ${itemIndex + 1} of ${items.length}` : undefined}
          onPointerDown={d === 0 ? down : undefined}
          onPointerMove={d === 0 ? move : undefined}
          onPointerUp={d === 0 ? up : undefined}
          onPointerCancel={d === 0 ? up : undefined}
        >
          {typeof children === "function" ? (
            children(items[itemIndex], itemIndex, d === 0)
          ) : (
            <div className="grid h-full w-full place-items-center rounded-lg border border-border/60 bg-card/80 font-mono text-[13px] text-foreground">
              {String(items[itemIndex])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
