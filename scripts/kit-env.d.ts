// Ambient types for building dither-kit as a standalone package
// (scripts/build-kit-package.mjs): the kit imports co-located CSS Modules.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>
  export default classes
}
