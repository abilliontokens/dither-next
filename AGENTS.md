# dither-next — the React/Next.js port

## Purpose

Parallel Next.js port of the Vue 3 `dither-kit` + `src` app. Lives alongside
the Vue app (which stays the source of truth) and does NOT touch it. The
engine layer is ported verbatim from `../dither-kit`; 339 kit `.tsx`
components (71 original + 99 new backgrounds/text-animations/animation-
effects + 10 generative effects + chart infrastructure + DitherRadar +
DitherFaultyTerminal + 38 ported interactive components + 40
dither-next-exclusive components with no Vue origin + 84 components from the
2026-10 upstream sync) and all three app routes (landing, docs, studio) are
ported. The kit matches the Vue kit component-for-component and leads it by
those 40 exclusive components — all wired into the public barrel, the studio
registry, and the docs.

- `dither-kit/` — the React kit: framework-agnostic TS (copied verbatim
  from the Vue kit) + Vue-reactivity→React conversions (contexts, hooks,
  controllers, roots, canvas wrappers). Owns its own `package.json` with
  peerDeps (react, d3-scale, d3-shape, clsx, tailwind-merge) so it stays
  copy-out portable, mirroring the Vue kit's promise. 260 `.tsx`
  components (+ chart infrastructure) + engine ported. New component
  categories ported from the Vue origin:
  - **Canvas backgrounds** (52 components): Aurora, Waves, Silk, Plasma,
    Ferrofluid, DarkVeil, Beams, Lightning, Galaxy, Radar (background),
    MetaBalls, Noise, Cubes, Ribbons, LaserFlow, etc. — all use the shared
    `useDitherBackground` hook.
  - **Text animations** (24 components): GradientText, ShinyText,
    GlitchText, CountUp, BlurText, DecryptedText, ScrollVelocity,
    FuzzyText, AsciiText, CircularText, etc.
  - **Animation effects** (23 components): AnimatedContent, FadeContent,
    GradualBlur, StarBorder, ElectricBorder, GlareHover, StickerPeel,
    Magnet, ClickSpark, BlobCursor, GhostCursor, Antigravity, LogoLoop,
    etc.
  - **Shared runtime**: `useDitherBackground` hook (React port of the Vue
    composable) — owns the RAF loop, buffer, visibility gate, resize, and
    dpr scaling for all canvas backgrounds.
  - **New docs sections**: Backgrounds, Text, Animations (3 new docs pages
    with 98 new section deep links).
  - **2026-10 upstream sync** (84 new `.tsx` + engine modules): 3D worlds
    and GLSL shaders through the dither raster (`DitherWorld`,
    `DitherShader`, `world.ts`, `world-gl.ts`, `gl.ts`, `shader.ts`), the
    stage (`DitherStage`/`DitherLayer`/`DitherContainer`, `keyframes.ts`,
    `containers.ts` resolveCq container queries), `DitherSequence`
    (`sequence.ts` timeline algebra), `DitherReveal` (ordered wipes,
    `wipe.ts`), `DitherFlowField`, `DitherThumbnail`, `DitherGrid`,
    `frameRate` stop-motion prop on every shared-runtime background
    (`timing.ts`), `useInviewLoop` perf gate on 8 cursor/text loops, the
    17 primitives (Box/Text/Portal/FocusScope/Pressable/InView/...), the
    60-glyph icon system (`DitherIcon`, `DitherIconSet`, `icons.ts`),
    typography (16), formatters/time (9), and the 30-component forms pack
    (Calendar, ColorPicker, DatePicker, Knob, TransferList, ...). The 5
    former fork-exclusive stand-ins with the same names (ColorPicker,
    DatePicker, MentionInput, SignaturePad, TagInput) were REPLACED by the
    upstream implementations — exclusives drop 45 → 40. Also: standalone
    stylesheet contract (`theme.css` tokens, `base.css` scoped base,
    `kit.css` compiled by `npm run build:css` into
    `public/kit/dither-kit.css`, `theme.ts` `applyTheme`/`themeVars`),
    `models.ts`, `score.ts` (score audio), `clock.ts` (seekable kit clock),
    tabs-underline/overlay-mono/command-Tab fixes. Engine file `radar.ts`
    was renamed `radar-bg.ts` (Windows tsc: `./radar` vs `./Radar` chart
    part collide case-insensitively); `Sequence.tsx`/`FlowField.tsx`/
    `Thumbnail.tsx` are `DitherSequence.tsx`/`DitherFlowField.tsx`/
    `DitherThumbnail.tsx` for the same reason.
- `app/` — Next.js App Router routes: `layout.tsx` (root shell +
  `AppProviders`), `page.tsx` (landing), `docs/` (section SSG +
  `generateStaticParams`), `studio/` (client studio).
- `src/` — the app in FSD: `views/{landing,docs,studio}` (uses `views/`
  not `pages/` — Next.js reserves `src/pages/` for the Pages Router),
  `shared/`, `entities/`, `features/`, `widgets/`.
- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` —
  the scaffold.

## Local Contracts

- Stack: Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4
  (via `@tailwindcss/postcss`), d3-scale, d3-shape, clsx, tailwind-merge.
- Aliases: `@/*` → `./src/*`, `@dither-kit` → `./dither-kit/index.ts`,
  `@dither-kit/*` → `./dither-kit/*` (tsconfig paths).
- Scripts: `dev` (`next dev --turbopack`), `build` (next build), `start`,
  `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`
  (`vitest`).
- Dev MUST run under Turbopack. Next 15.5.20's webpack dev server never writes
  `.next/routes-manifest.json`, and the App Router request path for
  `/docs/[section]` (`generateStaticParams` + `dynamicParams = false`) reads
  it — every route 500s with `ENOENT routes-manifest.json` after the first
  request or two. Turbopack dev is unaffected. `build` stays on webpack, so
  production output is unchanged.
- Never run `next build` against a tree with a live `next dev` (or vice
  versa): both own `.next/`, and the build wipes the manifests out from under
  the running server. Use `-p` to separate ports, never to share `.next`.
- `html-to-image` is a declared dep (studio PNG export); only reached on user
  action, no bundle bloat for non-studio routes.
- Tests: Vitest + @testing-library/react + jsdom, mirroring the Vue tree's
  20-spec suite. `vitest.config.ts` sets `environment: 'jsdom'`, the
  `@`/`@dither-kit` aliases, and `tests/setup.ts` (RTL cleanup + jest-dom +
  jsdom shims for ResizeObserver/IntersectionObserver/matchMedia/localStorage/
  PointerEvent/offsetParent — jsdom 25 lacks these). Specs live under
  `tests/` (root: engine + models) and `tests/components/` (RTL component
  specs). Pure-function specs import from `@dither-kit`/`@/entities`;
  component specs mount the ported `.tsx` via RTL. The editor store is
  immutable (`useSyncExternalStore`) — seed via `restoreDoc`/`setViewport`,
  read via `getEditorSnapshot()`.
- The kit dir has ZERO imports from `next/` or `../src/` — it must stay
  portable. `'use client'` directives are at the top of every file that uses
  React hooks/context (required by App Router for createContext/useRef/etc).
- Vue→React conversion rules (canonical names, documented in
  `../CONVERSION-GUIDE.md`):
  - `InjectionKey` → React `Context<T | null>`; `inject`/`useXxx` →
    `useContext` with the same boundary-guard errors.
  - `useChartController`/`usePolarController` are React hooks returning the
    context value; `ControllerInput` keeps the getter-facade shape (getters
    preserve `useMemo` dep-tracking). `markRaw` dropped (React doesn't need it).
  - `useChartDimensions<T>()` → `{ el: RefObject<T|null>, size }` (ref object,
    not a callback, so roots read `el.current` in pointer handlers).
  - `useCanvasVisibility(el, onWake)` → `() => boolean` reading a ref (no
    re-render on visibility transition; the RAF loop owns timing).
  - Series/variant registration is imperative state (ref + bump counter) so
    child parts register/unregister in effects without re-rendering the root.
  - `toast()` imperative API preserved; store is module-level emitter +
    `useSyncExternalStore` (no zustand).
  - Canvas RAF loops (`startXxxLoop`) are framework-agnostic and ported
    verbatim — they read state through `Box<T> = { readonly current: T }`.
    The React component wrappers own refs + lifecycle (mount/resize/visibility/
    teardown) via `useEffect` and wake the loop on context-field changes.
  - Chart layer routing: `defineCartesianChart`/`definePolarChart` factories
    return React components; slotted children route to back-canvas / front-svg
    / DOM layers by a static `chartLayer` property on the child's component.
- `precompile.ts` stays browser/SSR-safe (no DOM, no Vue, no server image
  encoder) — same contract as the Vue kit.
- SSR safety: `"use client"` components are still server-rendered during
  prerender, so render-path (module top-level, `useMemo`, or the render body
  before any `useInDom` early-return) MUST NOT touch `window`/`document`/
  `matchMedia`/`localStorage`/`IntersectionObserver`/`ResizeObserver`. Guard
  with `typeof window !== "undefined"` or move the access into a `useEffect`.
  Overlay portals gate on `useInDom()` (false on server) before
  `createPortal(..., document.body)`.
- The public barrel (`dither-kit/index.ts`) exports all ported symbols. Never
  export stubs.

## Verification

- `cd dither-next && npx tsc --noEmit` green.
- `cd dither-next && npm run test` — all spec files pass. The
  2026-10 sync components were verified via tsc + build + live docs
  sections, matching the earlier canvas-component convention.
- `cd dither-next && npm run build` succeeds; the docs route statically
  generates one page per section id (349 deep links) plus `/` and `/studio`.
- `npm run dev` serves every route under Turbopack: `/`, `/studio` and all
  349 `/docs/<section>` ids return 200, an unknown section returns 404
  (`dynamicParams = false`). A run of webpack `next dev` instead 500s.
- `npm run build:css` compiles `dither-kit/kit.css` →
  `public/kit/dither-kit.css` (standalone stylesheet for non-Tailwind
  consumers). `public/kit/` is gitignored build output — regenerate it,
  never commit it.
- The Vue app (`../dither-kit`, `../src`) is untouched by this workstream.

## Child DOX Index

- none — `dither-kit/` and `src/` are flat by design (no `AGENTS.md` in
  either yet). If either grows its own contracts, add a child doc here.
