# dither-kit

Dithered UI toolkit for React 19: composable ordered-dither charts (area, line, bar, pie, radar), generative backgrounds, a 3D model viewer, avatars, buttons, form controls and more. Everything draws through one tiny Bayer-dither canvas engine. React port of [dither-ui](https://github.com/drvova/dither-ui).

Docs and live examples: [dither-ui.com/docs](https://dither-ui.com/docs).

## Install

```sh
npm install dither-kit
```

Peer dependencies: `react`, `react-dom` (19), `@base-ui/react`, `clsx`, `tailwind-merge`, `d3-scale`, `d3-shape`. npm 7+ installs them automatically.

## Use

Import components from their own entry so your bundle only pulls what you use:

```tsx
import "dither-kit/styles.css"
import { DitherButton } from "dither-kit/DitherButton"
import { DitherGradient } from "dither-kit/DitherGradient"

export function Hero() {
  return (
    <section className="dither-kit relative">
      <DitherGradient from="green" direction="up" className="absolute inset-0" />
      <DitherButton color="green" variant="solid">Get started</DitherButton>
    </section>
  )
}
```

The barrel (`import { DitherButton } from "dither-kit"`) works too, at the cost of a larger graph in bundlers that tree-shake poorly.

Components that touch the DOM ship with `"use client"`, so they work from React Server Components in Next.js without extra config.

## Styling

`dither-kit/styles.css` is self-contained: the design tokens, a base scoped to `.dither-kit`, and every utility class the components use, all in `@layer dither-kit.*`, so your unlayered styles win. Wrap the area that holds kit components in an element with the `dither-kit` class.

Theme it by redefining the tokens (`--background`, `--foreground`, `--card`, `--border`, `--accent`, `--radius`, …); light values live on `:root`, dark ones under `.dark`. The raw sheets are also exported as `dither-kit/theme.css` and `dither-kit/base.css`.

Using Tailwind v4 already? Skip `styles.css`, import `dither-kit/theme.css`, and let Tailwind scan the package: `@source "../node_modules/dither-kit";` (path relative to your CSS file).

## License

MIT
