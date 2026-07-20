// Public API for Dither Kit (React / Next.js). Mirrors the Vue kit's surface
// for the engine + hooks; the `.vue` components become `.tsx` in later
// workstreams and are added below as they land.

// --- chart context, hooks, controllers (framework-agnostic engine + hooks) ---
export type {
  AreaVariant,
  ChartConfig,
  ChartType,
  Margins,
  SeriesKind,
  StrokeVariant,
} from "./chart-context"
export type { SeriesSpec } from "./chart-context"
export {
  ChartContext,
  useChart,
  useChartPart,
  useChartController,
  type ControllerInput,
  type ChartContextValue,
} from "./chart-context"
export { CommonChartContext, useCommonChart, type CommonChart, type TooltipItem } from "./common-context"
export { SeriesContext, useSeries, type SeriesContextValue } from "./series-context"
export type { PolarChartContextValue, PolarControllerInput } from "./polar-context"
export {
  PolarChartContext,
  usePolarChart,
  usePolarPart,
  usePolarController,
} from "./polar-context"

// --- chart roots (factories + props) ---
export { defineCartesianChart, type CartesianChartProps, type ChartCanvasComponent } from "./cartesian-root"
export {
  definePolarChart,
  type PolarChartProps,
  type PolarCanvasComponent,
  type PolarBackDecoration,
} from "./polar-root"

// --- canvas painters (framework-agnostic RAF loop + React component) ---
export { BarCanvas } from "./bar-canvas"
export { CartesianCanvas } from "./cartesian-canvas"
export { PieCanvas } from "./pie-canvas"
export { RadarCanvas } from "./radar-canvas"

// --- dither paint engine ---
export type {
  BloomBlend,
  BloomConfig,
  BloomInput,
  BloomLevel,
  BloomStyle,
  BezierPoints,
  DitherMatrix,
  EasingInput,
  EasingName,
  EdgeEffectParams,
  Glyph,
  PaintOpts,
  PaintTarget,
  SpinnerParams,
  TextureConfig,
  VariantInput,
} from "./dither-paint"
export {
  BAYER,
  CELL,
  MAX_COLS,
  MAX_ROWS,
  BORDER_ALPHA,
  OFF_TIER,
  bloomFromSeed,
  bloomLayerStyle,
  backingSize,
  colNoise,
  cubicBezier,
  easingFromSeed,
  easeInOutCubic,
  easeOutCubic,
  clamp01,
  effectFromSeed,
  EASINGS,
  geometryFromSeed,
  glyphFromSeed,
  kitFromSeed,
  matrixFromSeed,
  motionFromSeed,
  mulberry32,
  paintColumn,
  prefersReducedMotion,
  resample,
  resolveEasing,
  resolveMatrix,
  resolveTexture,
  revealFromSeed,
  sparklesFromSeed,
  spinnerFromSeed,
  SPINNER_DEFAULT,
  textureFromSeed,
} from "./dither-paint"

// --- standalone pixel engine (avatar / gradient / image) ---
export type { PixelBloom, PixelBloomConfig, PixelBloomInput, PixelBloomStyle, PixelColor } from "./pixel"
export {
  BAYER4,
  fnv1a,
  fillOf,
  hueFill,
  pixelBloomStyle,
  pixelMatrixFromSeed,
  pixelPrefersReducedMotion,
  xorshift32,
} from "./pixel"

// --- palette ---
export type { DitherColor, Rgb, Seed } from "./palette"
export {
  PALETTE,
  colorToHex,
  cssColor,
  hexToRgb,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  isDitherColor,
  rgb,
  rgbToHex,
  rgbToHsv,
  sampleRgbGradient,
  seedFromColor,
  seedFromHex,
  seedFromHue,
  seedOfColor,
} from "./palette"

// --- noise (deterministic 2D value-noise / fbm for generative backgrounds) ---
export { fbm, hash21, valueNoise } from "./noise"

// --- raster ---
export type { RasterBuffer } from "./raster"
export {
  blendRasterPixel,
  clearRasterBuffer,
  createRasterBuffer,
  putRasterBuffer,
  setOrBlendRasterPixel,
  setRasterPixel32,
} from "./raster"

// --- scales ---
export type { StackType } from "./scales"
export {
  buildBandScale,
  buildXScale,
  buildYScale,
  computeBands,
  indexAtBand,
  nearestIndex,
} from "./scales"

// --- polar geometry ---
export type { PieSlice, RadarAxis } from "./polar"
export {
  axisAtAngle,
  distToPolygonEdge,
  pieSlices,
  pointInPolygon,
  polarX,
  polarY,
  radarAxes,
  sliceAtAngle,
} from "./polar"

// --- gesture ---
export { project, rubberband, velocityFrom, type VelocitySample } from "./gesture"

// --- avatar pattern ---
export type { AvatarPattern, SeededPattern } from "./avatar-pattern"
export {
  clampGrid,
  normalizePattern,
  patternFromImage,
  patternFromPixels,
  seededPattern,
} from "./avatar-pattern"

// --- dot paint ---
export type { DotVariant } from "./dot-paint"
export { dotPaint } from "./dot-paint"

// --- precompile (browser/SSR-safe RGBA buffers) ---
// NOTE: `ButtonVariant` and `GradientDirection` are exported from the
// component modules (`./DitherButton`, `./DitherGradient`) to mirror the
// Vue barrel — they are NOT re-exported here to avoid duplicate-export
// conflicts with the component files (which define the same types).
export type {
  ButtonRasterOptions,
  DitherRenderMode,
  GradientRasterOptions,
  PrecompiledDither,
} from "./precompile"
export {
  DEFAULT_MAX_COLS,
  DEFAULT_MAX_ROWS,
  STATIC_DEFAULT_MAX_COLS,
  STATIC_DEFAULT_MAX_ROWS,
  precompiledSrc,
  renderDitherButton,
  renderDitherGradient,
} from "./precompile"

// --- control geometry + field context ---
export {
  CONTROL,
  CONTROL_BUTTON,
  POPOVER,
  FieldContext as FieldContextValue,
  useField,
} from "./control"

// --- toast (imperative store + hooks) ---
export { dismiss, toast, useDismiss, useToastStore, useToasts, type Toast } from "./toast"

// --- chart dimensions + visibility hooks ---
export { useChartDimensions, type Dimensions } from "./use-chart-dimensions"
export { useCanvasVisibility } from "./use-visibility"

// --- lib ---
export { cn } from "./lib"

// =========================================================================
// Component exports — grouped to mirror the Vue `dither-kit/index.ts` barrel.
// Components are named exports (no `export default`); the Vue barrel's
// `export { default as X }` therefore maps to `export { X }` here.
// =========================================================================

// --- Charts + series parts ---
export { Area } from "./Area"
export { Line } from "./Line"
export { AreaChart, LineChart } from "./area-chart"
export { Bar } from "./Bar"
export { BarChart } from "./bar-chart"
export { Pie } from "./Pie"
export { PieChart } from "./pie-chart"
export { Radar } from "./Radar"
export { RadarChart } from "./radar-chart"
export { RadarFrame } from "./RadarFrame"
export { CartesianSeries } from "./CartesianSeries"

// --- Chart parts (axes, grid, dots, legend, tooltip, sparkline) ---
export { Grid } from "./Grid"
export { XAxis } from "./XAxis"
export { YAxis } from "./YAxis"
export { Dot } from "./Dot"
export { ActiveDot } from "./ActiveDot"
export { Legend } from "./Legend"
export { Tooltip, type TooltipVariant } from "./Tooltip"
export { Sparkline } from "./Sparkline"

// --- Standalone pixel components ---
export { DitherAvatar, type AvatarMirror } from "./DitherAvatar"
export { DitherButton, type ButtonVariant } from "./DitherButton"
export { DitherGradient, type GradientDirection } from "./DitherGradient"
export { DitherImage } from "./DitherImage"
export {
  DitherFaultyTerminal,
  type FaultyTerminalParams,
  paintFaultyTerminal,
} from "./DitherFaultyTerminal"
export { DitherSpinner } from "./DitherSpinner"

// --- Canvas backgrounds (generative animated backgrounds) ---
// Each exports the component + its Params type + its paint function.
// `DitherSideRays` shares `RaysParams`/`paintRays` with `DitherLightRays`,
// so only the component is re-exported to avoid duplicate-export conflicts.
export { DitherAurora, type AuroraParams, paintAurora } from "./DitherAurora"
export { DitherWaves, type WavesParams, paintWaves } from "./DitherWaves"
export { DitherSilk, type SilkParams, paintSilk } from "./DitherSilk"
export { DitherPlasma, type PlasmaParams, paintPlasma } from "./DitherPlasma"
export { DitherLineWaves, type LineWavesParams, paintLineWaves } from "./DitherLineWaves"
export { DitherThreads, type ThreadsParams, paintThreads } from "./DitherThreads"
export { DitherDotGrid, type DotGridParams, paintDotGrid } from "./DitherDotGrid"
export { DitherRippleGrid, type RippleGridParams, paintRippleGrid } from "./DitherRippleGrid"
export { DitherIridescence, type IridescenceParams, paintIridescence } from "./DitherIridescence"
export { DitherPixelSnow, type PixelSnowParams, paintPixelSnow } from "./DitherPixelSnow"
export { DitherBeams, type BeamsParams, paintBeams } from "./DitherBeams"
export { DitherGridMotion, type GridMotionParams, paintGridMotion } from "./DitherGridMotion"
export { DitherGridScan, type GridScanParams, paintGridScan } from "./DitherGridScan"
export { DitherGridDistortion, type GridDistortionParams, paintGridDistortion } from "./DitherGridDistortion"
export { DitherLightRays, type RaysParams, paintRays } from "./DitherLightRays"
export { DitherSideRays } from "./DitherSideRays"
export { DitherLightPillar, type LightPillarParams, paintLightPillar } from "./DitherLightPillar"
export { DitherSoftAurora, type SoftAuroraParams, paintSoftAurora } from "./DitherSoftAurora"
export { DitherDotField, type DotFieldParams, paintDotField } from "./DitherDotField"
export { DitherColorBends, type ColorBendsParams, paintColorBends } from "./DitherColorBends"
export { DitherGradientBlinds, type GradientBlindsParams, paintGradientBlinds } from "./DitherGradientBlinds"
export { DitherGrainient, type GrainientParams, paintGrainient } from "./DitherGrainient"
export { DitherDither, type DitherBgParams, paintDitherBg } from "./DitherDither"
export { DitherFloatingLines, type FloatingLinesParams, paintFloatingLines } from "./DitherFloatingLines"
export { DitherPlasmaWave, type PlasmaWaveParams, paintPlasmaWave } from "./DitherPlasmaWave"
export { DitherLetterGlitch, type LetterGlitchParams, paintLetterGlitch } from "./DitherLetterGlitch"
export { DitherShapeGrid, type ShapeGridParams, paintShapeGrid } from "./DitherShapeGrid"
export { DitherLightning, type LightningParams, paintLightning } from "./DitherLightning"
export { DitherDarkVeil, type DarkVeilParams, paintDarkVeil } from "./DitherDarkVeil"
export { DitherLiquidChrome, type LiquidChromeParams, paintLiquidChrome } from "./DitherLiquidChrome"
export { DitherOrb, type OrbParams, paintOrb } from "./DitherOrb"
export { DitherPrism, type PrismParams, paintPrism } from "./DitherPrism"
export { DitherGalaxy, type GalaxyParams, paintGalaxy } from "./DitherGalaxy"
export { DitherBalatro, type BalatroParams, paintBalatro } from "./DitherBalatro"
export { DitherBallpit, type BallpitParams, paintBallpit } from "./DitherBallpit"
export { DitherEvilEye, type EvilEyeParams, paintEvilEye } from "./DitherEvilEye"
export { DitherHyperspeed, type HyperspeedParams, paintHyperspeed } from "./DitherHyperspeed"
export { DitherLightfall, type LightfallParams, paintLightfall } from "./DitherLightfall"
export { DitherPixelBlast, type PixelBlastParams, paintPixelBlast } from "./DitherPixelBlast"
export { DitherLiquidEther, type LiquidEtherParams, paintLiquidEther } from "./DitherLiquidEther"
export { DitherParticles, type ParticlesParams, paintParticles } from "./DitherParticles"
export { DitherFerrofluid, type FerrofluidParams, type FlowDirection, paintFerrofluid } from "./DitherFerrofluid"
export { DitherPrismaticBurst, type PrismaticBurstParams, paintPrismaticBurst } from "./DitherPrismaticBurst"
export { DitherMetaBalls, type MetaBallsParams, paintMetaBalls } from "./DitherMetaBalls"
export { DitherMetallicPaint, type MetallicPaintParams, paintMetallicPaint } from "./DitherMetallicPaint"
export { DitherNoise, type NoiseParams, paintNoiseField } from "./DitherNoise"
export { DitherCubes, type CubesParams, paintCubes } from "./DitherCubes"
export { DitherRibbons, type RibbonsParams, paintRibbons } from "./DitherRibbons"
export { DitherShapeBlur, type ShapeBlurParams, paintShapeBlur } from "./DitherShapeBlur"
export { DitherStrands, type StrandsParams, paintStrands } from "./DitherStrands"
export { DitherLaserFlow, type LaserFlowParams, paintLaserFlow } from "./DitherLaserFlow"
// NOTE: `DitherRadar` (background) is a SEPARATE export from `./DitherRadar`,
// distinct from the chart-part `Radar` exported above from `./Radar`.
export { DitherRadar, type RadarParams, paintRadar } from "./DitherRadar"

// --- useDitherBackground hook (shared RAF canvas hook for backgrounds) ---
export { useDitherBackground, type DitherBackgroundOptions } from "./use-dither-background"

// --- Text animations ---
export { DitherGradientText } from "./DitherGradientText"
export { DitherShinyText } from "./DitherShinyText"
export { DitherGlitchText } from "./DitherGlitchText"
export { DitherSplitText } from "./DitherSplitText"
export { DitherRotatingText } from "./DitherRotatingText"
export { DitherCountUp } from "./DitherCountUp"
export { DitherBlurText } from "./DitherBlurText"
export { DitherDecryptedText } from "./DitherDecryptedText"
export { DitherScrambleText } from "./DitherScrambleText"
export { DitherShuffle } from "./DitherShuffle"
export { DitherTextType } from "./DitherTextType"
export { DitherFallingText } from "./DitherFallingText"
export { DitherScrollReveal } from "./DitherScrollReveal"
export { DitherScrollFloat } from "./DitherScrollFloat"
export { DitherScrollVelocity } from "./DitherScrollVelocity"
export { DitherTextCursor } from "./DitherTextCursor"
export { DitherTextPressure } from "./DitherTextPressure"
export { DitherVariableProximity } from "./DitherVariableProximity"
export { DitherTrueFocus } from "./DitherTrueFocus"
export { DitherCircularText } from "./DitherCircularText"
export { DitherCurvedLoop } from "./DitherCurvedLoop"
export { DitherFuzzyText } from "./DitherFuzzyText"
export { DitherAsciiText } from "./DitherAsciiText"

// --- Animation effects ---
export { DitherAnimatedContent } from "./DitherAnimatedContent"
export { DitherFadeContent } from "./DitherFadeContent"
export { DitherGradualBlur } from "./DitherGradualBlur"
export { DitherStarBorder } from "./DitherStarBorder"
export { DitherElectricBorder } from "./DitherElectricBorder"
export { DitherGlareHover } from "./DitherGlareHover"
export { DitherMagnet } from "./DitherMagnet"
export { DitherClickSpark } from "./DitherClickSpark"
export { DitherBlobCursor } from "./DitherBlobCursor"
export { DitherCrosshair } from "./DitherCrosshair"
export { DitherGhostCursor } from "./DitherGhostCursor"
export { DitherSplashCursor } from "./DitherSplashCursor"
export { DitherTargetCursor } from "./DitherTargetCursor"
export { DitherPixelTrail } from "./DitherPixelTrail"
export { DitherImageTrail } from "./DitherImageTrail"
export { DitherAntigravity } from "./DitherAntigravity"
export { DitherLogoLoop } from "./DitherLogoLoop"
export { DitherMagicRings } from "./DitherMagicRings"
export { DitherMagnetLines } from "./DitherMagnetLines"
export { DitherOrbitImages } from "./DitherOrbitImages"
export { DitherPixelTransition } from "./DitherPixelTransition"
export { DitherStickerPeel } from "./DitherStickerPeel"

// --- Form controls ---
export { DitherSwitch } from "./DitherSwitch"
export { DitherCheckbox } from "./DitherCheckbox"
export { DitherCheckboxGroup } from "./DitherCheckboxGroup"
export { DitherSlider, type SliderVariant } from "./DitherSlider"
export { DitherProgress } from "./DitherProgress"

// --- Feedback ---
export { DitherBadge, type BadgeVariant } from "./DitherBadge"
export { DitherSkeleton } from "./DitherSkeleton"
export { DitherSeparator, type SeparatorOrientation } from "./DitherSeparator"

// --- Navigation & data ---
export { DitherBreadcrumb, type Crumb } from "./DitherBreadcrumb"
export { DitherPagination, pageList } from "./DitherPagination"
export { DitherRating } from "./DitherRating"
export { DitherStepper, type Step } from "./DitherStepper"
export { DitherTimeline, type TimelineItem } from "./DitherTimeline"

// --- Structure ---
export { DitherTabs, type TabItem, type TabsVariant } from "./DitherTabs"
export { DitherTabPanel } from "./DitherTabPanel"
export { DitherCollapsible } from "./DitherCollapsible"
export { DitherKbd } from "./DitherKbd"

// --- Overlays & menus ---
export { DitherPopover } from "./DitherPopover"
export { DitherMenu, type MenuItem } from "./DitherMenu"
export { DitherContextMenu, type ContextMenuItem } from "./DitherContextMenu"
export { DitherMenubar, type MenubarItem, type MenubarMenu } from "./DitherMenubar"
export { DitherTooltip } from "./DitherTooltip"
export { DitherPreviewCard } from "./DitherPreviewCard"
export { DitherDialog } from "./DitherDialog"
export { DitherAlertDialog } from "./DitherAlertDialog"
export { DitherDrawer, type DrawerSide } from "./DitherDrawer"
export { DitherDrawerIndent } from "./DitherDrawerIndent"
export { DitherSwipeArea } from "./DitherSwipeArea"
export { DitherAccordion, type AccordionItem } from "./DitherAccordion"
export { DitherToaster } from "./DitherToaster"
export { DitherScrollArea } from "./DitherScrollArea"

// --- Fields & forms ---
export { DitherInput } from "./DitherInput"
export { DitherTextarea } from "./DitherTextarea"
export { DitherField } from "./DitherField"
export { DitherFieldset } from "./DitherFieldset"
export { DitherForm } from "./DitherForm"
export { DitherNumberField } from "./DitherNumberField"
export { DitherOtpField } from "./DitherOtpField"

// --- Selection ---
export { DitherSelect, type Option } from "./DitherSelect"
export { DitherCombobox } from "./DitherCombobox"
export { DitherAutocomplete } from "./DitherAutocomplete"
export { DitherRadioGroup } from "./DitherRadioGroup"
export { DitherToggle } from "./DitherToggle"
export { DitherToggleGroup } from "./DitherToggleGroup"

// --- Surfaces & status ---
export {
  DitherSidebar,
  type SidebarCollapse,
  type SidebarDensity,
  type SidebarVariant,
} from "./DitherSidebar"
export { DitherSidebarItem } from "./DitherSidebarItem"
export { DitherSidebarGroup } from "./DitherSidebarGroup"
export { DitherSidebarSub } from "./DitherSidebarSub"
export { DitherNavMenu, type NavMenuItem } from "./DitherNavMenu"
export { DitherToolbar } from "./DitherToolbar"
export { DitherMeter } from "./DitherMeter"
