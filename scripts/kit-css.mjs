// Compile the kit's standalone stylesheet: dither-kit/kit.css (the tokens,
// the scoped base, Tailwind's utilities restricted to the kit's own sources)
// → dist/kit/dither-kit.css, for apps that style with anything but Tailwind.
// Ported from upstream scripts/kit-css.mjs; the only change is the default
// output path (this repo has no site-wide dist/ — the file lands in public/
// so a Next.js deployment can serve it at /kit/dither-kit.css).
// Runs in `npm run build:css` (NOT part of `next build` — the Next app
// consumes the kit through its own Tailwind pipeline).
import { compile, optimize } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ENTRY = fileURLToPath(new URL("../dither-kit/kit.css", import.meta.url))

/** The compiled stylesheet, minified unless asked otherwise. */
export async function buildKitCss({ minify = true } = {}) {
  const base = dirname(ENTRY)
  const compiler = await compile(readFileSync(ENTRY, "utf8"), { base, shouldRewriteUrls: true, onDependency() {} })
  const roots =
    compiler.root === "none"
      ? []
      : compiler.root === null
        ? [{ base, pattern: "**/*", negated: false }]
        : [{ ...compiler.root, negated: false }]
  const scanner = new Scanner({ sources: [...roots, ...compiler.sources] })
  const css = compiler.build(scanner.scan())
  return optimize(css, { minify }).code
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] ?? fileURLToPath(new URL("../public/kit/dither-kit.css", import.meta.url)))
  const css = await buildKitCss()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, css)
  console.log(`kit css: ${(css.length / 1024).toFixed(1)} kB → ${out}`)
}
