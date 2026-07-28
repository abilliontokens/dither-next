"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useInDom } from "./use-in-dom";
import { createPortal } from "react-dom";
import { CONTROL_BUTTON } from "./control";
import { cn } from "./lib";
import { BAYER4 } from "./pixel";

/** A wedge action. `icon` renders at the wedge centroid; `label` is the
 *  accessible name and the keyboard-walk announcement. */
export type RadialItem = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export interface DitherRadialMenuProps {
  items: RadialItem[];
  /** Ring radius in CSS px (the menu box is `2 * radius + pad`). */
  radius?: number;
  /** Controlled open state; falls back to internal state when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fired with the chosen item (and its index) on release/select. */
  onSelect?: (item: RadialItem, index: number) => void;
  /** Accessible label for the trigger + menu. */
  label?: string;
  /** The anchor control. Defaults to a "menu" glyph button. */
  children?: ReactNode;
  className?: string;
}

const HOLD_MS = 180;
const HOLD_MOVE_PX = 6;

function polar(cx: number, cy: number, r: number, thetaDeg: number): { x: number; y: number } {
  const rad = (thetaDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/** Pointer angle from a screen-space centre, clockwise from top (0°=12 o'clock). */
function angleFrom(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  return (((Math.atan2(dx, -dy) * 180) / Math.PI) + 360) % 360;
}

/** Build a wedge SVG path centred on the top, clockwise. */
function wedgePath(cx: number, cy: number, r: number, step: number, i: number): string {
  const center = i * step;
  const p1 = polar(cx, cy, r, center - step / 2);
  const p2 = polar(cx, cy, r, center + step / 2);
  const large = step > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

/**
 * DitherRadialMenu — press-and-hold pie menu. Pointer-down fans a ring of
 * wedges around the trigger; the wedge under the pointer angle highlights, and
 * release selects it. A quick click (no hold, no drift) flips the menu into a
 * sticky mode so it is fully usable without a hold gesture — the same affordance
 * touchpads/users who can't hold get.
 *
 * The wedges are SVG paths filled with a Bayer `<pattern>` built from the kit's
 * own `BAYER4` matrix (2px cells, ~half lit), so the ring reads in the same
 * dither grain as the charts/slider rather than a flat vector fill. The pattern
 * id is `useId`-scoped so multiple instances never collide.
 *
 * Fully keyboard-operable: the trigger is a button (`aria-haspopup="menu"`);
 * Enter/Space opens, Arrows/Home/End walk the `menuitem`s, Enter selects,
 * Escape closes and restores focus. Pointer state for the hold/click decision
 * lives in refs (read only in handlers); `open`/`active`/`sticky` live in state
 * because they drive the rendered portal. Portal-mount is gated on
 * `useInDom()` (SSR-safe) exactly like `DitherDialog`.
 */
export function DitherRadialMenu({
  items,
  radius = 84,
  open: openProp,
  onOpenChange,
  onSelect,
  label = "Radial menu",
  children,
  className,
}: DitherRadialMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuitemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reactId = useId();
  const patternId = `${reactId}-bayer`;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [active, setActive] = useState(0);
  const [sticky, setSticky] = useState(false);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [still, setStill] = useState(false);
  const [shown, setShown] = useState(false);

  // Hold/click gesture plumbing — refs because they are read only in handlers.
  const downAtRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const holdingRef = useRef(false);
  // Suppresses the synthetic click that follows a pointer gesture, and tracks
  // open-state transitions so focus is restored only on a real open→close.
  const suppressClickRef = useRef(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    setStill(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    );
  }, []);

  function setOpen(next: boolean): void {
    setInternalOpen(next);
    onOpenChange?.(next);
  }

  function select(i: number): void {
    const item = items[i];
    if (!item || item.disabled) return;
    onSelect?.(item, i);
    setOpen(false);
  }
  /** Open in sticky mode (keyboard / assistive activation — no hold gesture). */
  function openSticky(): void {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    setActive(0);
    setSticky(true);
    setOpen(true);
  }

  // Entrance scale: snap to full under reduced motion; else ease in.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    if (still) {
      setShown(true);
      return;
    }
    let raf = 0;
    raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open, still]);

  // Focus management: on open, move focus to the first item; on a real
  // open→close transition, restore focus to the trigger (the prevOpen guard
  // skips the initial mount run where open is already false).
  useEffect(() => {
    if (open) {
      prevOpenRef.current = true;
      menuitemRefs.current[0]?.focus();
    } else if (prevOpenRef.current) {
      prevOpenRef.current = false;
      holdingRef.current = false;
      downAtRef.current = null;
      triggerRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const n = items.length;
  const step = n > 0 ? 360 / n : 360;
  const size = radius * 2 + 48;
  const cx = size / 2;
  const cy = size / 2;

  function wedgeAt(x: number, y: number): number {
    if (n === 0) return -1;
    const theta = angleFrom(center.x, center.y, x, y);
    return ((Math.round(theta / step) % n) + n) % n;
  }

  // --- trigger: opens + owns the hold/click gesture -------------------------
  function onTriggerPointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (e.button !== 0) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    setActive(0);
    setSticky(false);
    setOpen(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    holdingRef.current = true;
    suppressClickRef.current = true; // the pointer gesture owns this interaction
    downAtRef.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }

  function onTriggerPointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (!holdingRef.current) return;
    const i = wedgeAt(e.clientX, e.clientY);
    if (i >= 0) setActive(i);
  }

  function onTriggerPointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const down = downAtRef.current;
    downAtRef.current = null;
    const i = wedgeAt(e.clientX, e.clientY);
    const moved =
      down != null
        ? Math.hypot(e.clientX - down.x, e.clientY - down.y) > HOLD_MOVE_PX
        : true;
    const held = down != null ? e.timeStamp - down.t > HOLD_MS : true;
    if (!moved && !held) {
      // Quick click with no drift → sticky: stay open, no select.
      setSticky(true);
    } else {
      // Releasing on a disabled wedge (or empty ring) → stay sticky so the
      // user can pick another; a valid wedge selects and closes.
      const item = i >= 0 ? items[i] : undefined;
      if (item && !item.disabled) select(i);
      else setSticky(true);
    }
  }

  // --- menu keyboard (role="menu") -----------------------------------------
  function onMenuKeydown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    if (n === 0) return;
    let next = active;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (active + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (active - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(active);
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
    menuitemRefs.current[next]?.focus();
  }

  function onBackdropPointerDown(): void {
    if (sticky) setOpen(false);
  }

  const inDom = useInDom();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          CONTROL_BUTTON,
          "inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
          className,
        )}
        onPointerDown={onTriggerPointerDown}
        onPointerMove={onTriggerPointerMove}
        onPointerUp={onTriggerPointerUp}
        onPointerCancel={onTriggerPointerUp}
        onClick={() => {
          // A pointer gesture sets suppressClickRef so the synthetic click that
          // follows is ignored; otherwise this is a keyboard/assistive
          // activation (Enter/Space) and we open in sticky mode.
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          openSticky();
        }}
      >
        {children ?? <span aria-hidden="true">⊹</span>}
      </button>

      {open && inDom
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <div
                aria-hidden="true"
                className="absolute inset-0"
                onPointerDown={onBackdropPointerDown}
              />
              <div
                role="menu"
                aria-label={label}
                onKeyDown={onMenuKeydown}
                className="absolute"
                style={{
                  left: center.x - size / 2,
                  top: center.y - size / 2,
                  width: size,
                  height: size,
                  transform: `scale(${shown ? 1 : 0.8})`,
                  opacity: shown ? 1 : 0,
                  transition: still
                    ? "none"
                    : "transform 120ms cubic-bezier(0.2,0,0,1), opacity 120ms ease",
                }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  className="absolute inset-0"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern
                      id={patternId}
                      width={8}
                      height={8}
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width={8} height={8} fill="currentColor" opacity={0.16} />
                      {BAYER4.map((row, y) =>
                        row.map((v, x) =>
                          v > 0.5 ? (
                            <rect
                              key={`${x}-${y}`}
                              x={x * 2}
                              y={y * 2}
                              width={2}
                              height={2}
                              fill="currentColor"
                            />
                          ) : null,
                        ),
                      )}
                    </pattern>
                  </defs>
                  {items.map((item, i) => {
                    const isActive = i === active && !item.disabled;
                    return (
                      <path
                        key={i}
                        d={wedgePath(cx, cy, radius, step, i)}
                        fill={`url(#${patternId})`}
                        stroke="var(--border)"
                        strokeWidth={isActive ? 2 : 1}
                        style={{
                          color: isActive
                            ? "var(--accent, var(--swatch-blue, #358ff3))"
                            : "var(--muted-foreground)",
                          outline: isActive ? "none" : undefined,
                        }}
                      />
                    );
                  })}
                </svg>

                {items.map((item, i) => {
                  const c = polar(cx, cy, radius * 0.62, i * step);
                  const isActive = i === active;
                  return (
                    <button
                      key={i}
                      ref={(el) => {
                        menuitemRefs.current[i] = el;
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={isActive ? 0 : -1}
                      disabled={item.disabled}
                      aria-label={item.label}
                      className={cn(
                        "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2px] text-[12px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                        item.disabled && "opacity-40",
                      )}
                      style={{ left: c.x, top: c.y }}
                      onPointerMove={() => setActive(i)}
                      onClick={() => select(i)}
                    >
                      {item.icon ?? item.label.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
