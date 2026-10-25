"use client";

import { useRef, useState, type HTMLAttributes } from "react";
import { flushSync } from "react-dom";

import { DitherInput } from "./DitherInput";
import { cn } from "./lib";

/** Click-to-edit text: view mode is a button (keyboard reachable), edit mode
 * is a focus-selected input. Enter or blur commits (only when the value
 * actually changed), Escape reverts — the revert flag suppresses the blur
 * commit that would otherwise fire as the input unmounts.
 * Port of InlineEdit.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `emit("save", v)` → `onSave(v)`, `emit("cancel")` → `onCancel()`; attrs fall
 * through onto the root span via `...rest`; the `$el` ref + `nextTick` focus →
 * `flushSync` then `querySelector("input")` on the root, since DitherInput does
 * not forward refs; an `editingLive` ref drops a second commit from the
 * unmount-time blur after Enter, whose closure holds stale props in React). */
export interface DitherInlineEditProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onChange" | "onCancel"> {
  value?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DitherInlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = "—",
  disabled = false,
  className,
  ...rest
}: DitherInlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const canceled = useRef(false);
  const editingLive = useRef(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  function enterEdit() {
    if (disabled) return;
    canceled.current = false;
    editingLive.current = true;
    flushSync(() => {
      setDraft(value ?? "");
      setEditing(true);
    });
    const input = rootRef.current?.querySelector("input");
    input?.focus();
    input?.select();
  }

  function commit() {
    if (canceled.current) {
      canceled.current = false;
      return;
    }
    if (!editingLive.current) return;
    editingLive.current = false;
    setEditing(false);
    const next = draft;
    if (next !== (value ?? "")) {
      onChange?.(next);
      onSave?.(next);
    }
  }

  function cancel() {
    canceled.current = true;
    editingLive.current = false;
    setDraft(value ?? "");
    setEditing(false);
    onCancel?.();
  }

  return (
    <span {...rest} ref={rootRef} className={cn("inline-flex w-full min-w-0", className)}>
      {!editing ? (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "max-w-full truncate rounded px-1.5 py-1 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-40",
            !value && "text-muted-foreground/70",
            "font-mono text-[13px]",
          )}
          onClick={enterEdit}
        >
          {value || placeholder}
        </button>
      ) : (
        <DitherInput
          value={draft}
          placeholder={placeholder}
          className="py-1"
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
        />
      )}
    </span>
  );
}

export default DitherInlineEdit;
