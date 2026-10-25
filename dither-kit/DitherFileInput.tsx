"use client";

import { useRef, useState, type DragEvent, type HTMLAttributes } from "react";

import { DitherButton } from "./DitherButton";
import DitherFileSizeText from "./DitherFileSizeText";
import DitherIcon from "./DitherIcon";
import { cn } from "./lib";

/** File picker with a visible selection: a hidden native input (label
 * driven, so it's keyboard-reachable), the chosen files listed with sizes,
 * per-file remove, one clear-all. The model is `File[]` — read-only in the
 * DOM, owned by the parent through v-model:files.
 * Port of FileInput.vue (`modelValue` → `value`; upstream's `commit` emits
 * `update:modelValue` + `change` together → ONE `onChange` call; fallthrough
 * attrs → `...rest` onto the root; Clear all drops the inert `size="sm"`). */
export interface DitherFileInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: File[];
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  buttonLabel?: string;
  onChange?: (files: File[]) => void;
  className?: string;
}

export function DitherFileInput({
  value,
  multiple = false,
  accept,
  disabled = false,
  buttonLabel = "Choose files",
  onChange,
  className,
  ...rest
}: DitherFileInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const files = value ?? [];

  function onInputFiles() {
    const list = inputRef.current?.files;
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    onChange?.(multiple ? [...files, ...picked] : [picked[0] as File]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    if (dropped.length === 0) return;
    onChange?.(multiple ? [...files, ...dropped] : [dropped[0] as File]);
  }

  return (
    <div {...rest} className={cn("grid gap-2", className)}>
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 bg-card/30 px-4 py-6 text-center transition-colors has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30 motion-reduce:transition-none",
          dragOver && "border-accent/70 bg-accent/10",
          disabled && "pointer-events-none opacity-40",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(!disabled);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={accept}
          disabled={disabled}
          onChange={onInputFiles}
        />
        <DitherIcon name="Plus" size={16} className="text-muted-foreground" />
        <span className="text-[12.5px] text-muted-foreground">
          Drop files here or{" "}
          <span className="text-foreground underline underline-offset-2">{buttonLabel}</span>
        </span>
        {accept ? <span className="text-[11px] text-muted-foreground/70">{accept}</span> : null}
      </label>

      {files.length > 0 ? (
        <ul className="grid gap-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded border border-border/60 bg-card/50 px-2.5 py-1.5"
            >
              <DitherIcon name="Check" size={12} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{file.name}</span>
              <DitherFileSizeText bytes={file.size} className="shrink-0 text-[11px] text-muted-foreground" />
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none motion-reduce:transition-none"
                onClick={() => onChange?.(files.filter((_, j) => j !== i))}
              >
                <DitherIcon name="Close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <DitherButton variant="solid" disabled={disabled} className="justify-self-start" onClick={() => onChange?.([])}>
          Clear all
        </DitherButton>
      ) : null}
    </div>
  );
}

export default DitherFileInput;
