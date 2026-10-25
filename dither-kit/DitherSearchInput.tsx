"use client";

import DitherIcon from "./DitherIcon";
import { DitherInput, type DitherInputProps } from "./DitherInput";
import { cn } from "./lib";

/** Search field: leading glyph, one-click clear (shown only when there is
 * something to clear), Escape empties the field.
 * Port of SearchInput.vue (`modelValue`/`update:modelValue` → `value`/`onChange`;
 * `emit("clear")` → `onClear()`; `v-bind="$attrs"` → `...rest` onto the inner
 * DitherInput; a consumer `onKeyDown` runs before the Escape handler, as Vue
 * merges fallthrough listeners). */
export interface DitherSearchInputProps extends Omit<DitherInputProps, "type"> {
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DitherSearchInput({
  value,
  onChange,
  onClear,
  placeholder,
  disabled,
  className,
  onKeyDown,
  ...rest
}: DitherSearchInputProps) {
  return (
    <div className="relative">
      <DitherIcon
        name="Search"
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
      />
      <DitherInput
        {...rest}
        type="search"
        value={value ?? ""}
        placeholder={placeholder ?? "Search…"}
        disabled={disabled}
        className={cn("pl-8 pr-8 [&::-webkit-search-cancel-button]:appearance-none", className)}
        onChange={onChange}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === "Escape") {
            e.stopPropagation();
            onChange?.("");
            onClear?.();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            onChange?.("");
            onClear?.();
          }}
        >
          <DitherIcon name="Close" size={13} />
        </button>
      ) : null}
    </div>
  );
}

export default DitherSearchInput;
