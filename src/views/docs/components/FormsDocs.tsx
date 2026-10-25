"use client";

import { useState } from "react";

import {
  DitherCalendar,
  DitherCascadeSelect,
  DitherCheckboxCard,
  DitherChoiceChips,
  DitherCodeInput,
  DitherColorSwatch,
  DitherCurrencyInput,
  DitherEmailInput,
  DitherField,
  DitherFileInput,
  DitherFontPicker,
  DitherHotkeyInput,
  DitherIconPicker,
  DitherInlineEdit,
  DitherInput,
  DitherInputGroup,
  DitherKeyValueInput,
  DitherKnob,
  DitherLanguageSelect,
  DitherListBox,
  DitherMonthPicker,
  DitherMultiSelect,
  DitherPasswordInput,
  DitherPhoneInput,
  DitherScrubInput,
  DitherSearchInput,
  DitherTransferList,
  type DitherCascadeNode,
  type DitherKeyValueRow,
} from "@dither-kit";

import { DemoCard } from "../DemoCard";
import { PropsTable, type PropRow } from "../PropsTable";

/**
 * FormsDocs — the "forms" group section pack.
 * Port of `src/pages/docs/forms/FormsDocs.vue`.
 *
 * Upstream's forms group has 30 sections; this pack renders 25 of them. The
 * color-picker, tag-input, date-picker, mention-input and signature-pad
 * sections live in `FormDocs.tsx` (form-controls group): section ids are one
 * flat global namespace, so they are not rendered (or defined) here.
 *
 * Upstream demos bind static `model-value`s; here each becomes a `useState`
 * seeded with the same value and wired through the component's controlled
 * `value` + `onChange` pair, so every demo is interactive.
 */

const CASCADE_TREE: DitherCascadeNode[] = [
  {
    value: "Japan",
    children: [
      { value: "Kansai", children: [{ value: "Kyoto" }, { value: "Osaka" }] },
      { value: "Kanto", children: [{ value: "Tokyo" }, { value: "Yokohama" }] },
    ],
  },
  {
    value: "Korea",
    children: [{ value: "Seoul Region", children: [{ value: "Seoul" }, { value: "Incheon" }] }],
  },
];

const SWATCHES = [
  { color: "#5227FF", label: "Iris" },
  { color: "#7CFF67", label: "Mint" },
  { color: "#FFB454", label: "Amber" },
  { color: "#FF5C7A", label: "Rose" },
  { color: "#4CC2FF", label: "Sky" },
] as const;

const SNIPPET_PASSWORD_INPUT = `<DitherField label="Password">
  <DitherPasswordInput value={pw} onChange={setPw} placeholder="At least 12 characters" />
</DitherField>`;

const SNIPPET_SEARCH_INPUT = `<DitherSearchInput value={q} onChange={setQ} onClear={resetResults} />`;

const SNIPPET_EMAIL_INPUT = `<DitherEmailInput value={email} onChange={setEmail} />`;

const SNIPPET_PHONE_INPUT = `<DitherPhoneInput value={phone} onChange={setPhone} />`;

const SNIPPET_CURRENCY_INPUT = `<DitherCurrencyInput value={amount} onChange={setAmount} prefix="$" />`;

const SNIPPET_SCRUB_INPUT = `<DitherScrubInput value={opacity} onChange={setOpacity} min={0} max={100} step={1} />`;

const SNIPPET_HOTKEY_INPUT = `<DitherHotkeyInput value={binding} onChange={setBinding} />`;

const SNIPPET_CODE_INPUT = `<DitherCodeInput value={snippet} onChange={setSnippet} onSubmit={run} rows={8} />`;

const SNIPPET_INPUT_GROUP = `<DitherInputGroup prefix="https://" suffix="/docs">
  <DitherInput value={host} onChange={setHost} className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
</DitherInputGroup>`;

const SNIPPET_INLINE_EDIT = `<DitherInlineEdit value={name} onChange={setName} onSave={persist} />`;

const SNIPPET_CHOICE_CHIPS = `<DitherChoiceChips value={size} onChange={(v) => typeof v === "string" && setSize(v)}
  options={["S", "M", "L", "XL"]} />
<DitherChoiceChips value={tags} onChange={(v) => Array.isArray(v) && setTags(v)} multiple
  options={["bug", "feat", "docs"]} />`;

const SNIPPET_CHECKBOX_CARD = `<DitherCheckboxCard value={on} onChange={setOn}
  label="Telemetry"
  description="Anonymous usage stats help pick the next components" />`;

const SNIPPET_KEY_VALUE_INPUT = `<DitherKeyValueInput value={headers} onChange={setHeaders} />`;

const SNIPPET_FILE_INPUT = `<DitherFileInput value={picked} onChange={setPicked} multiple accept="image/*" />`;

const SNIPPET_LIST_BOX = `<DitherListBox value={city} onChange={setCity} options={["Kyoto", "Seoul", "Taipei"]} onSelect={go} />`;

const SNIPPET_MULTI_SELECT = `<DitherMultiSelect value={tags} onChange={setTags} options={ALL_TAGS} onSearch={filter} />`;

const SNIPPET_CASCADE_SELECT = `<DitherCascadeSelect value={region} onChange={setRegion} tree={TREE}
  placeholders={["Country", "Region", "City"]} />`;

const SNIPPET_TRANSFER_LIST = `<DitherTransferList value={roles} onChange={setRoles} source={ALL_ROLES}
  sourceLabel="Roles" targetLabel="Assigned" />`;

const SNIPPET_LANGUAGE_SELECT = `<DitherLanguageSelect value={locale} onChange={setLocale} includeDefault />`;

const SNIPPET_ICON_PICKER = `<DitherIconPicker value={glyph} onChange={(name) => { setGlyph(name); save(name) }} />`;

const SNIPPET_FONT_PICKER = `<DitherFontPicker value={font} onChange={setFont} />`;

const SNIPPET_CALENDAR = `<DitherCalendar value={day} onChange={setDay} max={today} />`;

const SNIPPET_MONTH_PICKER = `<DitherMonthPicker value={month} onChange={setMonth} />`;

const SNIPPET_COLOR_SWATCH = `{palette.map((c) => (
  <DitherColorSwatch key={c} color={c}
    selected={c === active} onSelect={setActive} />
))}`;

const SNIPPET_KNOB = `<DitherKnob value={gain} onChange={setGain} min={0} max={100} step={1} />`;

const API: Record<string, PropRow[]> = {
  passwordInput: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "invalid", type: "boolean", default: "false" },
  ],
  searchInput: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "onClear", type: "() on clear/Escape", default: "" },
  ],
  emailInput: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "autoComplete", type: "string", default: '"email"' },
  ],
  phoneInput: [
    { prop: "value / onChange", type: "string (formatted)", default: '""' },
    { prop: "autoComplete", type: "string", default: '"tel"' },
  ],
  currencyInput: [
    { prop: "value / onChange", type: "string (digits[.digits])", default: '""' },
    { prop: "prefix", type: "string", default: '"$"' },
    { prop: "locale", type: "string", default: '"en-US"' },
  ],
  scrubInput: [
    { prop: "value / onChange", type: "number", default: "0" },
    { prop: "min / max / step", type: "number", default: "0 / 100 / 1" },
  ],
  hotkeyInput: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "placeholder", type: "string", default: '"Press a shortcut…"' },
  ],
  codeInput: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "rows", type: "number", default: "6" },
    { prop: "onSubmit", type: "() on Ctrl/Cmd + Enter", default: "" },
  ],
  inputGroup: [
    { prop: "prefix / suffix", type: "ReactNode (addons)", default: "" },
    { prop: "children", type: "ReactNode (the control)", default: "" },
  ],
  inlineEdit: [
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "onSave / onCancel", type: "(value) / ()", default: "" },
  ],
  choiceChips: [
    { prop: "options", type: "string[]", default: "[]" },
    { prop: "value / onChange", type: "string | string[]", default: '"" / []' },
    { prop: "multiple", type: "boolean (checkbox mode)", default: "false" },
  ],
  checkboxCard: [
    { prop: "value / onChange", type: "boolean", default: "false" },
    { prop: "label / description", type: "string", default: '""' },
  ],
  keyValueInput: [
    { prop: "value / onChange", type: "{ key, value }[]", default: "[]" },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  fileInput: [
    { prop: "value", type: "File[]", default: "[]" },
    { prop: "multiple", type: "boolean", default: "false" },
    { prop: "accept", type: "string (input accept)", default: "" },
    { prop: "onChange", type: "(File[]) after pick/remove", default: "" },
  ],
  listBox: [
    { prop: "options", type: "string[]", default: "[]" },
    { prop: "value / onChange", type: "string", default: '""' },
    { prop: "onSelect", type: "(value) on commit", default: "" },
  ],
  multiSelect: [
    { prop: "options", type: "string[]", default: "[]" },
    { prop: "value / onChange", type: "string[]", default: "[]" },
    { prop: "onSearch", type: "(query) as you type", default: "" },
  ],
  cascadeSelect: [
    { prop: "tree", type: "{ value, children? }[]", default: "[]" },
    { prop: "value / onChange", type: "string[] path", default: "[]" },
    { prop: "placeholders", type: "string[] per level", default: "Level n" },
  ],
  transferList: [
    { prop: "source", type: "string[] (pool)", default: "[]" },
    { prop: "value / onChange", type: "string[] (destination)", default: "[]" },
    { prop: "sourceLabel / targetLabel", type: "string", default: "Available / Selected" },
  ],
  languageSelect: [
    { prop: "value / onChange", type: "string (BCP 47 tag)", default: '"en"' },
    { prop: "includeDefault", type: "boolean (first entry)", default: "false" },
    { prop: "defaultLabel", type: "string", default: '"System default"' },
  ],
  iconPicker: [
    { prop: "value / onChange", type: "string (icon name)", default: '""' },
    { prop: "size", type: "number (px)", default: "16" },
    { prop: "placeholder", type: "string (filter)", default: '"Filter icons…"' },
  ],
  fontPicker: [
    { prop: "value / onChange", type: "string (CSS font stack)", default: '""' },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  calendar: [
    { prop: "value / onChange", type: "string (ISO date)", default: '""' },
    { prop: "min / max", type: "string (ISO)", default: "" },
  ],
  monthPicker: [
    { prop: "value / onChange", type: "string (YYYY-MM)", default: '""' },
    { prop: "disabled", type: "boolean", default: "false" },
  ],
  colorSwatch: [
    { prop: "color", type: "string (css color)", default: '"#5227FF"' },
    { prop: "label", type: "string (aria name)", default: "the color" },
    { prop: "selected", type: "boolean (ring)", default: "false" },
    { prop: "size", type: "number (px)", default: "24" },
    { prop: "onSelect", type: "(color) on click", default: "" },
  ],
  knob: [
    { prop: "value / onChange", type: "number", default: "50" },
    { prop: "min / max / step", type: "number", default: "0 / 100 / 1" },
    { prop: "size", type: "number (px)", default: "72" },
  ],
};

export function FormsDocs() {
  const [password, setPassword] = useState("correct-horse-battery");
  const [search, setSearch] = useState("dither");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("(415) 555-2671");
  const [amount, setAmount] = useState("1234567.5");
  const [opacity, setOpacity] = useState(64);
  const [binding, setBinding] = useState("Ctrl+Shift+K");
  const [code, setCode] = useState("const dither = bayer(4)");
  const [host, setHost] = useState("dither-ui.com");
  const [displayName, setDisplayName] = useState("bogdan");
  const [size, setSize] = useState("M");
  const [chipTags, setChipTags] = useState<string[]>(["bug"]);
  const [telemetry, setTelemetry] = useState(true);
  const [beta, setBeta] = useState(false);
  const [headers, setHeaders] = useState<DitherKeyValueRow[]>([
    { key: "Content-Type", value: "application/json" },
    { key: "X-Client", value: "dither-ui" },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [city, setCity] = useState("Seoul");
  const [stack, setStack] = useState<string[]>(["vue", "dither"]);
  const [region, setRegion] = useState<string[]>(["Japan", "Kansai"]);
  const [roles, setRoles] = useState<string[]>(["admin"]);
  const [locale, setLocale] = useState("ja");
  const [glyph, setGlyph] = useState("Check");
  const [font, setFont] = useState("'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace");
  const [day, setDay] = useState("2026-10-07");
  const [month, setMonth] = useState("2026-10");
  const [swatch, setSwatch] = useState<string>("#5227FF");
  const [gain, setGain] = useState(64);
  const [trim, setTrim] = useState(25);

  return (
    <>
      <section id="password-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">PasswordInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Password field with a reveal toggle: the type flips text/password, the button carries its own accessible name
          and never submits (<code className="text-foreground/80">type=&quot;button&quot;</code>).
        </p>
        <DemoCard code={SNIPPET_PASSWORD_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherField label="Password">
              <DitherPasswordInput value={password} onChange={setPassword} placeholder="At least 12 characters" />
            </DitherField>
          </div>
        </DemoCard>
        <PropsTable rows={API.passwordInput} />
      </section>

      <section id="search-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">SearchInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Leading glyph, one-click clear (only when there is something to clear) and Escape empties the field. Either
          way it calls <code className="text-foreground/80">onClear</code> so results can reset in the same beat.
        </p>
        <DemoCard code={SNIPPET_SEARCH_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherSearchInput value={search} onChange={setSearch} />
          </div>
        </DemoCard>
        <PropsTable rows={API.searchInput} />
      </section>

      <section id="email-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">EmailInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The three things a bare text input gets wrong, fixed in one place:{" "}
          <code className="text-foreground/80">type=email</code>,{" "}
          <code className="text-foreground/80">inputmode=email</code>,{" "}
          <code className="text-foreground/80">autocomplete=email</code>.
        </p>
        <DemoCard code={SNIPPET_EMAIL_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherEmailInput value={email} onChange={setEmail} />
          </div>
        </DemoCard>
        <PropsTable rows={API.emailInput} />
      </section>

      <section id="phone-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">PhoneInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Digits normalized into the <code className="text-foreground/80">(415) 555-2671</code> shape while you type
          (10-digit NANP), tel keyboard on mobile. The model is always the formatted string; the caret is end-anchored by
          design.
        </p>
        <DemoCard code={SNIPPET_PHONE_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherPhoneInput value={phone} onChange={setPhone} />
          </div>
        </DemoCard>
        <PropsTable rows={API.phoneInput} />
      </section>

      <section id="currency-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">CurrencyInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Money entry with predictable mechanics: the model stays a plain decimal string (
          <code className="text-foreground/80">&quot;1234.56&quot;</code>), the display groups thousands while blurred
          and shows raw digits while focused so typing and the caret stay sane. Digits and one dot only.
        </p>
        <DemoCard code={SNIPPET_CURRENCY_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherCurrencyInput value={amount} onChange={setAmount} />
          </div>
        </DemoCard>
        <PropsTable rows={API.currencyInput} />
      </section>

      <section id="scrub-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">ScrubInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The Figma-style drag gesture on a number: the grip is a real{" "}
          <code className="text-foreground/80">role=&quot;slider&quot;</code> (arrow keys, PageUp/Down and Home/End work
          without a pointer), and the read-only input stays selectable for copying. Values snap to{" "}
          <code className="text-foreground/80">step</code>.
        </p>
        <DemoCard code={SNIPPET_SCRUB_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherField label="Opacity" description="Drag the grip, or focus it and use the arrows">
              <DitherScrubInput value={opacity} onChange={setOpacity} min={0} max={100} step={1} />
            </DitherField>
          </div>
        </DemoCard>
        <PropsTable rows={API.scrubInput} />
      </section>

      <section id="hotkey-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">HotkeyInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Shortcut capture: modifiers hold until a non-modifier key arrives, repeat is ignored, Escape clears. Value
          shape: <code className="text-foreground/80">Ctrl+Shift+K</code> (order Ctrl, Alt, Shift, Meta, then the key).
        </p>
        <DemoCard code={SNIPPET_HOTKEY_INPUT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherField label="Command palette" description="Click the field, then press the combo">
              <DitherHotkeyInput value={binding} onChange={setBinding} />
            </DitherField>
          </div>
        </DemoCard>
        <PropsTable rows={API.hotkeyInput} />
      </section>

      <section id="code-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">CodeInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Code entry where Tab indents (two spaces), Shift+Tab dedents the selected lines, and Ctrl/Cmd+Enter fires{" "}
          <code className="text-foreground/80">onSubmit</code>. The browser&apos;s tab trap is handled once, here.
        </p>
        <DemoCard code={SNIPPET_CODE_INPUT}>
          <div className="mx-auto w-full max-w-md">
            <DitherCodeInput value={code} onChange={setCode} rows={4} />
          </div>
        </DemoCard>
        <PropsTable rows={API.codeInput} />
      </section>

      <section id="input-group" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">InputGroup</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Addon slots around a control in one bordered group: the group owns the border and the focus-within ring, the
          inner control drops its own chrome (the code tab shows the exact class set).
        </p>
        <DemoCard code={SNIPPET_INPUT_GROUP}>
          <div className="mx-auto w-full max-w-sm">
            <DitherInputGroup prefix="https://" suffix="/docs">
              <DitherInput
                value={host}
                onChange={setHost}
                className="min-h-8 border-0 bg-transparent px-0 py-1 shadow-none hover:border-0 focus-visible:ring-0"
              />
            </DitherInputGroup>
          </div>
        </DemoCard>
        <PropsTable rows={API.inputGroup} />
      </section>

      <section id="inline-edit" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">InlineEdit</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Click-to-edit text: view mode is a real button (keyboard reachable), edit mode focus-selects. Enter or blur
          commits (only when the value actually changed). Escape reverts.
        </p>
        <DemoCard code={SNIPPET_INLINE_EDIT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherField label="Display name" description="Click the value to edit it">
              <DitherInlineEdit value={displayName} onChange={setDisplayName} />
            </DitherField>
          </div>
        </DemoCard>
        <PropsTable rows={API.inlineEdit} />
      </section>

      <section id="choice-chips" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">ChoiceChips</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Chip-style choice group where the chip IS the label of a real radio (or checkbox when{" "}
          <code className="text-foreground/80">multiple</code>). Native keyboard semantics and focus come for free: no
          roving tabindex to get wrong.
        </p>
        <DemoCard code={SNIPPET_CHOICE_CHIPS}>
          <div className="mx-auto grid max-w-sm gap-4">
            <DitherChoiceChips
              value={size}
              onChange={(v) => {
                if (typeof v === "string") setSize(v);
              }}
              options={["S", "M", "L", "XL"]}
            />
            <DitherChoiceChips
              value={chipTags}
              onChange={(v) => {
                if (Array.isArray(v)) setChipTags(v);
              }}
              multiple
              options={["bug", "feat", "docs"]}
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.choiceChips} />
      </section>

      <section id="checkbox-card" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">CheckboxCard</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The whole card is the checkbox&apos;s label: title and description ride along, one click anywhere toggles, the
          focus ring shows keyboard focus. The checkbox stays the source of truth.
        </p>
        <DemoCard code={SNIPPET_CHECKBOX_CARD}>
          <div className="mx-auto grid max-w-sm gap-2">
            <DitherCheckboxCard
              value={telemetry}
              onChange={setTelemetry}
              label="Telemetry"
              description="Anonymous usage stats help pick the next components"
            />
            <DitherCheckboxCard
              value={beta}
              onChange={setBeta}
              label="Beta channel"
              description="Get breaking changes before everyone else"
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.checkboxCard} />
      </section>

      <section id="key-value-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">KeyValueInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Repeatable key/value rows: headers, metadata, query params. Every edit emits the whole array (the parent owns
          the truth), rows are added and removed from the bottom.
        </p>
        <DemoCard code={SNIPPET_KEY_VALUE_INPUT}>
          <div className="mx-auto w-full max-w-md">
            <DitherKeyValueInput value={headers} onChange={setHeaders} />
          </div>
        </DemoCard>
        <PropsTable rows={API.keyValueInput} />
      </section>

      <section id="file-input" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">FileInput</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          File picker with a visible selection: a hidden native input driven by its label (keyboard-reachable), files
          listed with sizes, per-file remove, clear-all, and drop-zone drag styling. The model is{" "}
          <code className="text-foreground/80">File[]</code>, owned by the parent.
        </p>
        <DemoCard code={SNIPPET_FILE_INPUT}>
          <div className="mx-auto w-full max-w-sm">
            <DitherFileInput value={files} onChange={setFiles} multiple accept="image/*" />
          </div>
        </DemoCard>
        <PropsTable rows={API.fileInput} />
      </section>

      <section id="list-box" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">ListBox</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Single-select with the full WAI-ARIA keyboard contract: arrows move the active option, Home/End jump,
          Enter/Space selects, and the active row carries{" "}
          <code className="text-foreground/80">aria-activedescendant</code> so focus never leaves the listbox itself.
        </p>
        <DemoCard code={SNIPPET_LIST_BOX}>
          <div className="mx-auto w-full max-w-[16rem]">
            <DitherListBox value={city} onChange={setCity} options={["Kyoto", "Seoul", "Taipei", "Osaka", "Busan"]} />
          </div>
        </DemoCard>
        <PropsTable rows={API.listBox} />
      </section>

      <section id="multi-select" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">MultiSelect</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Chips for what&apos;s picked, native checkboxes for what&apos;s pickable, a filter box over the pool. Keyboard
          semantics come from the checkboxes, and the selected set stays visible and individually removable.
        </p>
        <DemoCard code={SNIPPET_MULTI_SELECT}>
          <div className="mx-auto w-full max-w-sm">
            <DitherMultiSelect
              value={stack}
              onChange={setStack}
              options={["vue", "dither", "canvas", "tokens", "ssr"]}
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.multiSelect} />
      </section>

      <section id="cascade-select" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">CascadeSelect</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Dependent pickers: each level&apos;s options come from the tree under the current path, and changing a parent
          truncates the deeper segments (the classic cascade rule, in one component). The model is the chosen path.
        </p>
        <DemoCard code={SNIPPET_CASCADE_SELECT}>
          <div className="mx-auto w-full max-w-md">
            <DitherCascadeSelect
              value={region}
              onChange={setRegion}
              tree={CASCADE_TREE}
              placeholders={["Country", "Region", "City"]}
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.cascadeSelect} />
      </section>

      <section id="transfer-list" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">TransferList</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Two-panel shuttle: the source pool stays put, the destination IS the model. Checkboxes select in either
          direction, Add/Remove move the selection, Add all/Remove all flush. Every control is a real button.
        </p>
        <DemoCard code={SNIPPET_TRANSFER_LIST}>
          <div className="mx-auto w-full max-w-xl">
            <DitherTransferList
              value={roles}
              onChange={setRoles}
              source={["admin", "editor", "viewer", "billing", "support"]}
              sourceLabel="Roles"
              targetLabel="Assigned"
            />
          </div>
        </DemoCard>
        <PropsTable rows={API.transferList} />
      </section>

      <section id="language-select" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">LanguageSelect</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Language picker over a curated BCP 47 list: the label is the human name, the value is the tag, and{" "}
          <code className="text-foreground/80">includeDefault</code> keeps the opt-out one option away.
        </p>
        <DemoCard code={SNIPPET_LANGUAGE_SELECT}>
          <div className="mx-auto w-full max-w-xs">
            <DitherLanguageSelect value={locale} onChange={setLocale} />
          </div>
        </DemoCard>
        <PropsTable rows={API.languageSelect} />
      </section>

      <section id="icon-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">IconPicker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The kit&apos;s own glyphs behind a name filter: a radio grid, so arrow keys roam the whole grid as one tab
          stop. Value = the icon name, ready for <code className="text-foreground/80">&lt;DitherIcon&gt;</code>.
        </p>
        <DemoCard code={SNIPPET_ICON_PICKER}>
          <div className="mx-auto w-full max-w-sm">
            <DitherIconPicker value={glyph} onChange={setGlyph} />
          </div>
        </DemoCard>
        <PropsTable rows={API.iconPicker} />
      </section>

      <section id="font-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">FontPicker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Each option renders its own name in its own family. The preview IS the choice, so no swatch can drift from the
          value. Value = the CSS font stack string.
        </p>
        <DemoCard code={SNIPPET_FONT_PICKER}>
          <div className="mx-auto w-full max-w-sm">
            <DitherFontPicker value={font} onChange={setFont} />
          </div>
        </DemoCard>
        <PropsTable rows={API.fontPicker} />
      </section>

      <section id="calendar" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Calendar</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Month grid with real grid semantics: arrows move the day, PageUp/PageDown change month, Home/End jump to week
          edges, and the model is ISO <code className="text-foreground/80">YYYY-MM-DD</code> so timezone math never
          enters the picture. Today gets a ring, the selected day the fill.
        </p>
        <DemoCard code={SNIPPET_CALENDAR}>
          <div className="flex justify-center">
            <DitherCalendar value={day} onChange={setDay} />
          </div>
        </DemoCard>
        <PropsTable rows={API.calendar} />
      </section>

      <section id="month-picker" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">MonthPicker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Year + twelve-month grid: model is <code className="text-foreground/80">YYYY-MM</code>, arrows roam the grid
          (three columns), PageUp/PageDown shift the year, the current month keeps a ring.
        </p>
        <DemoCard code={SNIPPET_MONTH_PICKER}>
          <div className="flex justify-center">
            <DitherMonthPicker value={month} onChange={setMonth} />
          </div>
        </DemoCard>
        <PropsTable rows={API.monthPicker} />
      </section>

      <section id="color-swatch" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">ColorSwatch</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          One color as a pickable chip: a real button with the color in its accessible name, a selected ring, a keyboard
          focus ring. Reads as pure display when nothing listens to{" "}
          <code className="text-foreground/80">onSelect</code>.
        </p>
        <DemoCard code={SNIPPET_COLOR_SWATCH}>
          <div className="flex justify-center gap-2">
            {SWATCHES.map((s) => (
              <DitherColorSwatch
                key={s.color}
                color={s.color}
                label={s.label}
                selected={s.color === swatch}
                onSelect={setSwatch}
              />
            ))}
          </div>
        </DemoCard>
        <PropsTable rows={API.colorSwatch} />
      </section>

      <section id="knob" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Knob</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Rotary control with the reliable gesture: drag VERTICALLY to change the value (angle-following wraps badly at
          the detent), arrows / PageUp-Down / Home-End on the keyboard, full slider semantics. The indicator sweeps
          270°.
        </p>
        <DemoCard code={SNIPPET_KNOB}>
          <div className="flex justify-center gap-6">
            <DitherKnob value={gain} onChange={setGain} />
            <DitherKnob value={trim} onChange={setTrim} size={56} />
            <DitherKnob value={90} size={88} disabled />
          </div>
        </DemoCard>
        <PropsTable rows={API.knob} />
      </section>
    </>
  );
}
