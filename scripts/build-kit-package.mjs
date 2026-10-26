// Build the publishable `dither-kit` npm package into dither-kit/dist.
//
// The source package (dither-kit/package.json) ships raw TypeScript for git
// consumers that transpile it themselves (the `kit` branch). npm consumers get
// compiled ESM + declarations instead, so this script emits a separate
// manifest into dist/ and `npm publish dither-kit/dist` publishes that.
//
//   1. tsc → dist/*.js + *.d.ts ("use client" directives are preserved)
//   2. relative specifiers rewritten to explicit `.js` (Node ESM / node16 types)
//   3. CSS Modules and the raw token/base sheets copied alongside
//   4. dist/dither-kit.css: the standalone compiled stylesheet (kit-css.mjs)
//   5. dist/package.json, README.md, LICENSE
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildKitCss } from "./kit-css.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const KIT = join(ROOT, "dither-kit")
const DIST = join(KIT, "dist")

rmSync(DIST, { recursive: true, force: true })
execFileSync(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "-p", join(KIT, "tsconfig.build.json")], {
  stdio: "inherit",
})

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

// The ambient CSS-module typings live outside the kit; tsc mirrors them under dist/scripts.
rmSync(join(DIST, "scripts"), { recursive: true, force: true })
if (existsSync(join(DIST, "dither-kit"))) throw new Error("unexpected nested dist/dither-kit: check tsconfig rootDir")

/** `./x` → `./x.js` or `./x/index.js`, resolved against the emitted files. */
function withExtension(file, spec) {
  if (!spec.startsWith(".") || /\.(js|css|json)$/.test(spec)) return spec
  const base = resolve(dirname(file), spec)
  if (existsSync(`${base}.js`)) return `${spec}.js`
  if (existsSync(join(base, "index.js"))) return `${spec}/index.js`
  throw new Error(`cannot resolve ${spec} from ${relative(DIST, file)}`)
}
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.[^"']*)\2/g
for (const file of walk(DIST)) {
  if (!/\.(js|d\.ts)$/.test(file)) continue
  const code = readFileSync(file, "utf8")
  const out = code.replace(SPECIFIER, (_, lead, q, spec) => `${lead}${q}${withExtension(file.replace(/\.d\.ts$/, ".js"), spec)}${q}`)
  if (out !== code) writeFileSync(file, out)
}

for (const name of readdirSync(KIT)) {
  if (name.endsWith(".css")) copyFileSync(join(KIT, name), join(DIST, name))
}
writeFileSync(join(DIST, "dither-kit.css"), await buildKitCss())

const src = JSON.parse(readFileSync(join(KIT, "package.json"), "utf8"))
const manifest = {
  name: src.name,
  version: src.version,
  description: src.description,
  license: "MIT",
  author: "abilliontokens",
  repository: { type: "git", url: "git+https://github.com/abilliontokens/dither-next.git", directory: "dither-kit" },
  homepage: "https://github.com/abilliontokens/dither-next#readme",
  bugs: "https://github.com/abilliontokens/dither-next/issues",
  keywords: src.keywords,
  type: "module",
  main: "./index.js",
  module: "./index.js",
  types: "./index.d.ts",
  sideEffects: ["*.css"],
  exports: {
    ".": { types: "./index.d.ts", default: "./index.js" },
    "./styles.css": "./dither-kit.css",
    "./package.json": "./package.json",
    "./*.css": "./*.css",
    "./*": { types: "./*.d.ts", default: "./*.js" },
  },
  // Public declarations reference d3 scale/shape types; ship them so strict
  // (skipLibCheck: false) consumers type-check without extra installs.
  dependencies: { "@types/d3-scale": "^4.0.8", "@types/d3-shape": "^3.1.6" },
  peerDependencies: src.peerDependencies,
  peerDependenciesMeta: src.peerDependenciesMeta,
}
writeFileSync(join(DIST, "package.json"), JSON.stringify(manifest, null, 2) + "\n")
copyFileSync(join(KIT, "README.md"), join(DIST, "README.md"))
copyFileSync(join(ROOT, "LICENSE"), join(DIST, "LICENSE"))
console.log(`dither-kit ${manifest.version} → ${relative(ROOT, DIST)} (${walk(DIST).length} files)`)
