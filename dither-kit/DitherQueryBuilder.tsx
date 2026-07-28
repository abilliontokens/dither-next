"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { BAYER4, fillOf, pixelMatrixFromSeed, type PixelColor } from "./pixel";
import { kitFromSeed } from "./dither-paint";
import { rgb } from "./palette";
import { CONTROL, CONTROL_BUTTON } from "./control";
import { cn } from "./lib";

export type DitherQueryFieldType = "string" | "number" | "date" | "boolean";

export interface DitherQueryField {
  key: string;
  label: string;
  type: DitherQueryFieldType;
  /** For string fields with a fixed option set, renders a <select> instead of free text. */
  options?: string[];
}

export type DitherQueryRule = {
  field: string;
  op: string;
  value: string;
};

export type DitherQueryCombinator = "and" | "or";

export interface DitherQueryBuilderProps {
  fields: DitherQueryField[];
  value: DitherQueryRule[];
  onChange: (rules: DitherQueryRule[]) => void;
  /** How rules combine. Controlled; omit for uncontrolled (defaults to "and"). */
  combinator?: DitherQueryCombinator;
  onCombinatorChange?: (c: DitherQueryCombinator) => void;
  color?: PixelColor;
  seed?: number;
  className?: string;
  /** Accessible label. */
  label?: string;
}

const CELL = 2;

type OpDef = { value: string; label: string };

/** Type-aware operator sets. "group controls" (per the brief) are realised as the
 *  combinator that joins the rule group (AND / OR) — a flat stack rather than an
 *  arbitrary nested group tree, which keeps the API a flat `Rule[]`. */
const OPS: Record<DitherQueryFieldType, OpDef[]> = {
  string: [
    { value: "eq", label: "equals" },
    { value: "contains", label: "contains" },
    { value: "starts", label: "starts with" },
    { value: "ends", label: "ends with" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "lt", label: "<" },
    { value: "gt", label: ">" },
    { value: "lte", label: "≤" },
    { value: "gte", label: "≥" },
  ],
  date: [
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "between", label: "between" },
  ],
  boolean: [
    { value: "true", label: "is true" },
    { value: "false", label: "is false" },
  ],
};

function defaultOp(type: DitherQueryFieldType | undefined): string {
  return OPS[type ?? "string"][0].value;
}

/** Paint the 2px left rail — a vertical dither ramp fading downward, the same
 *  recipe as DitherAccordion / DitherCollapsible. Only the active rule's rail is
 *  painted, so the accent travels as you Tab between rules. */
function paintRail(canvas: HTMLCanvasElement, color: PixelColor, matrix: number[][]): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const height = canvas.offsetHeight;
  if (!ctx || height <= 0) return;
  const rows = Math.max(4, Math.round(height / CELL));
  canvas.width = 1;
  canvas.height = rows;
  const fill = fillOf(color);
  ctx.clearRect(0, 0, 1, rows);
  for (let y = 0; y < rows; y++) {
    const density = 1 - (y + 0.5) / rows;
    const lit = density > matrix[y & 3][0];
    const a = lit ? 0.35 + 0.65 * density : 0.12 * density;
    if (a <= 0.004) continue;
    ctx.fillStyle = rgb(fill, 1, a);
    ctx.fillRect(0, y, 1, 1);
  }
}

function clearRail(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * DitherQueryBuilder — a visual filter builder. Rules stack vertically; each row
 * is field-select → operator-select → value-input, with add/remove and an
 * AND/OR combinator (the group join). Operators are type-aware (string:
 * equals/contains/starts-with/ends-with; number: =,≠,<,>,≤,≥; date:
 * before/after/between; boolean: is true/is false). The **active rule carries a
 * Bayer-dithered accent rail** (the DitherAccordion ramp recipe) that travels as
 * focus moves between rules.
 *
 * Controlled via `value`/`onChange`; `combinator`/`onCombinatorChange` are
 * optional (default AND). Switching a rule's field resets its operator to the
 * new type's default and clears the value.
 *
 * Accessibility: the rule list is a `role="group"`; each row is a labelled
 * `role="group"`. Native Tab moves through the controls. Enter on a value input
 * (or the Add button) appends a rule; Backspace on an empty value input removes
 * that rule. Selects/inputs carry descriptive aria-labels.
 *
 * SSR / hydration: `activeIndex` is an integer (rail top is integer geometry);
 * rails are painted/cleared in an effect; ids come from `useId`.
 */
export function DitherQueryBuilder({
  fields,
  value,
  onChange,
  combinator: combinatorProp,
  onCombinatorChange,
  color: colorProp,
  seed,
  className,
  label = "Filter builder",
}: DitherQueryBuilderProps) {
  const s = seed !== undefined ? kitFromSeed(seed) : null;
  const color: PixelColor = colorProp ?? s?.hue ?? "orange";
  const matrix = seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4;

  const fieldByKey = useMemo(() => {
    const m = new Map<string, DitherQueryField>();
    for (const f of fields) m.set(f.key, f);
    return m;
  }, [fields]);

  const [internalCombinator, setInternalCombinator] = useState<DitherQueryCombinator>("and");
  const combinator = combinatorProp ?? internalCombinator;
  const setCombinator = useCallback((c: DitherQueryCombinator) => {
    if (combinatorProp === undefined) setInternalCombinator(c);
    onCombinatorChange?.(c);
  }, [combinatorProp, onCombinatorChange]);

  const [activeIndex, setActiveIndex] = useState<number>(value.length ? 0 : -1);

  const updateRule = useCallback((i: number, patch: Partial<DitherQueryRule>) => {
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }, [value, onChange]);

  const addRule = useCallback(() => {
    const firstField = fields[0];
    onChange([...value, { field: firstField?.key ?? "", op: defaultOp(firstField?.type), value: "" }]);
  }, [fields, value, onChange]);

  const removeRule = useCallback((i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    setActiveIndex((cur) => Math.max(-1, Math.min(cur, value.length - 2)));
  }, [value, onChange]);

  const onFieldChange = useCallback((i: number, fieldKey: string) => {
    const type = fieldByKey.get(fieldKey)?.type;
    updateRule(i, { field: fieldKey, op: defaultOp(type), value: "" });
  }, [fieldByKey, updateRule]);

  // --- dithered accent rails (active rule only) ------------------------------
  const railsRef = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const paint = () => {
      railsRef.current.forEach((canvas, i) => {
        if (!canvas) return;
        if (i === activeIndex) paintRail(canvas, color, matrix);
        else clearRail(canvas);
      });
    };
    const raf = requestAnimationFrame(paint);
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(paint);
      railsRef.current.forEach((c) => { if (c?.parentElement) ro?.observe(c.parentElement); });
    }
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [activeIndex, color, matrix, value.length]);

  const reactId = useId();

  /** Render the type-appropriate value control for a rule. */
  const renderValue = (rule: DitherQueryRule, i: number) => {
    const field = fieldByKey.get(rule.field);
    const type = field?.type ?? "string";
    const ariaBase = `Rule ${i + 1} value for ${field?.label ?? rule.field}`;

    const common = {
      "aria-label": ariaBase,
      onFocus: () => setActiveIndex(i),
      className: cn(CONTROL, "min-h-9 h-9 py-1 text-[12px]"),
    };

    if (type === "boolean") {
      // The operator already encodes true/false; no value control needed.
      return <span className="self-center text-[11px] text-muted-foreground">—</span>;
    }
    if (type === "string" && field?.options) {
      return (
        <select
          {...common}
          value={rule.value}
          onChange={(e) => updateRule(i, { value: e.target.value })}
          onKeyDown={(e) => onValueKey(e, i)}
        >
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (type === "number") {
      return (
        <input
          {...common}
          type="number"
          value={rule.value}
          placeholder="0"
          onChange={(e) => updateRule(i, { value: e.target.value })}
          onKeyDown={(e) => onValueKey(e, i)}
        />
      );
    }
    if (type === "date") {
      if (rule.op === "between") {
        const [a, b] = rule.value.split(",");
        return (
          <span className="flex items-center gap-1">
            <input
              type="date"
              aria-label={`${ariaBase} from`}
              value={a ?? ""}
              onFocus={() => setActiveIndex(i)}
              className={cn(CONTROL, "h-9 py-1 text-[12px]")}
              onChange={(e) => updateRule(i, { value: [e.target.value, b ?? ""].join(",") })}
              onKeyDown={(e) => onValueKey(e, i)}
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              aria-label={`${ariaBase} to`}
              value={b ?? ""}
              onFocus={() => setActiveIndex(i)}
              className={cn(CONTROL, "h-9 py-1 text-[12px]")}
              onChange={(e) => updateRule(i, { value: [a ?? "", e.target.value].join(",") })}
              onKeyDown={(e) => onValueKey(e, i)}
            />
          </span>
        );
      }
      return (
        <input
          {...common}
          type="date"
          value={rule.value}
          onChange={(e) => updateRule(i, { value: e.target.value })}
          onKeyDown={(e) => onValueKey(e, i)}
        />
      );
    }
    return (
      <input
        {...common}
        type="text"
        value={rule.value}
        placeholder="value"
        onChange={(e) => updateRule(i, { value: e.target.value })}
        onKeyDown={(e) => onValueKey(e, i)}
      />
    );
  };

  const onValueKey = (e: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>, i: number) => {
    const el = e.currentTarget;
    if (e.key === "Backspace" && el.tagName === "INPUT" && (el as HTMLInputElement).value === "") {
      e.preventDefault();
      removeRule(i);
    } else if (e.key === "Enter") {
      e.preventDefault();
      addRule();
      setActiveIndex(value.length);
    }
  };

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card/30 p-2 font-mono text-foreground", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div role="group" aria-label="Combine rules with" className="flex items-center gap-1">
          {(["and", "or"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={combinator === c}
              onClick={() => setCombinator(c)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] uppercase",
                combinator === c ? "border-accent/70 bg-accent/10 text-foreground" : "border-border/50 text-muted-foreground hover:border-foreground/30",
                CONTROL_BUTTON,
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Filter rules">
        {value.length === 0 ? (
          <p className="px-1 py-3 text-[12px] text-muted-foreground">No rules yet.</p>
        ) : (
          value.map((rule, i) => {
            const field = fieldByKey.get(rule.field);
            const type = field?.type ?? "string";
            const ops = OPS[type];
            const isActive = activeIndex === i;
            return (
              <div
                key={i}
                role="group"
                aria-label={`Rule ${i + 1}`}
                onFocus={() => setActiveIndex(i)}
                className={cn(
                  "relative mb-1.5 flex flex-wrap items-center gap-1.5 rounded-md border bg-background/40 pl-3 pr-1 py-1",
                  isActive ? "border-accent/40" : "border-border/40",
                )}
              >
                {/* Dithered accent rail (active rule only). */}
                <span aria-hidden="true" className="absolute left-0 top-0 h-full w-[2px] overflow-hidden">
                  <canvas
                    ref={(el) => { railsRef.current[i] = el; }}
                    className="absolute inset-0 h-full w-full"
                    style={{ imageRendering: "pixelated" }}
                  />
                </span>
                <select
                  aria-label={`Rule ${i + 1} field`}
                  value={rule.field}
                  onFocus={() => setActiveIndex(i)}
                  onChange={(e) => onFieldChange(i, e.target.value)}
                  className={cn(CONTROL, "h-9 min-w-[8rem] py-1 text-[12px]")}
                >
                  {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select
                  aria-label={`Rule ${i + 1} operator`}
                  value={rule.op}
                  onFocus={() => setActiveIndex(i)}
                  onChange={(e) => updateRule(i, { op: e.target.value })}
                  className={cn(CONTROL, "h-9 min-w-[6rem] py-1 text-[12px]")}
                >
                  {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {renderValue(rule, i)}
                <button
                  type="button"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() => removeRule(i)}
                  className={cn("rounded-md border border-border/50 px-2 py-1 text-[12px] text-muted-foreground hover:border-foreground/30 hover:text-foreground", CONTROL_BUTTON)}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={addRule}
        className={cn("mt-1 w-full rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[12px] text-muted-foreground hover:border-foreground/30 hover:text-foreground", CONTROL_BUTTON)}
      >
        + Add rule
      </button>
      <span className="sr-only" id={`${reactId}-desc`}>{`${label}. Tab between controls, Enter adds a rule, Backspace on an empty value removes it.`}</span>
    </div>
  );
}
