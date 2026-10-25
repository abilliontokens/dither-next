// Nav items for the forms section pack. Verbatim port of
// src/pages/docs/forms/forms-nav.ts — section ids are permanent deep links.
//
// Upstream moved color-picker, tag-input, mention-input, date-picker and
// signature-pad here from form-nav.ts; the fork still owns those five in
// FORM_NAV (rendered by FormDocs), so nav-registry drops them from this
// group and FormsDocs does not render them — ids stay globally unique.
export const FORMS_NAV = [
  { id: "password-input", label: "PasswordInput" },
  { id: "search-input", label: "SearchInput" },
  { id: "email-input", label: "EmailInput" },
  { id: "phone-input", label: "PhoneInput" },
  { id: "currency-input", label: "CurrencyInput" },
  { id: "scrub-input", label: "ScrubInput" },
  { id: "hotkey-input", label: "HotkeyInput" },
  { id: "code-input", label: "CodeInput" },
  { id: "input-group", label: "InputGroup" },
  { id: "inline-edit", label: "InlineEdit" },
  { id: "tag-input", label: "TagInput" },
  { id: "choice-chips", label: "ChoiceChips" },
  { id: "checkbox-card", label: "CheckboxCard" },
  { id: "key-value-input", label: "KeyValueInput" },
  { id: "mention-input", label: "MentionInput" },
  { id: "file-input", label: "FileInput" },
  { id: "list-box", label: "ListBox" },
  { id: "multi-select", label: "MultiSelect" },
  { id: "cascade-select", label: "CascadeSelect" },
  { id: "transfer-list", label: "TransferList" },
  { id: "language-select", label: "LanguageSelect" },
  { id: "icon-picker", label: "IconPicker" },
  { id: "font-picker", label: "FontPicker" },
  { id: "calendar", label: "Calendar" },
  { id: "date-picker", label: "DatePicker" },
  { id: "month-picker", label: "MonthPicker" },
  { id: "color-swatch", label: "ColorSwatch" },
  { id: "color-picker", label: "ColorPicker" },
  { id: "knob", label: "Knob" },
  { id: "signature-pad", label: "SignaturePad" },
] as const;
