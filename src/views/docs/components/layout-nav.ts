// Nav items for the layout section pack. Verbatim port of
// src/pages/docs/components/layout-nav.ts — section ids are permanent deep links.
// `grid` is omitted: DitherGrid is not yet ported to the React kit.
export const LAYOUT_NAV = [
  { id: "dither-shell", label: "Shell" },
  { id: "rail", label: "Rail" },
  { id: "console", label: "Console" },
  { id: "canvas", label: "Canvas" },
  { id: "infinite-canvas", label: "Infinite canvas" },
  { id: "terminal-prompt", label: "Terminal prompt" },
] as const;
