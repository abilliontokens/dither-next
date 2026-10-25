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
export { cn, round, px, ms, sec, deg, em } from "./lib"

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
export { DitherThumbnail, type DitherThumbnailProps } from "./DitherThumbnail"
export { DitherFlowField, paintFlowField, fadeRasterAlpha, type FlowFieldParams, type DitherFlowFieldProps } from "./DitherFlowField"
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
export { DitherCenterMorphModal } from "./DitherCenterMorphModal"
export { DitherAlertDialog } from "./DitherAlertDialog"
export { DitherDrawer, type DrawerSide } from "./DitherDrawer"
export { DitherDrawerIndent } from "./DitherDrawerIndent"
export { DitherSwipeArea } from "./DitherSwipeArea"
export { DitherAccordion, type AccordionItem } from "./DitherAccordion"
export { DitherBouncyAccordion, type BouncyItem } from "./DitherBouncyAccordion"
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
export { DitherWheelPicker, type WheelOption } from "./DitherWheelPicker"

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
export { DitherShell } from "./DitherShell"
export { DitherRail } from "./DitherRail"
export { DitherConsole, type ConsoleLevel, type ConsoleLine } from "./DitherConsole"
export { DitherCanvas } from "./DitherCanvas"

// --- Generative canvas effects (seeded) ---
export { DitherPulseField, type PulseParams } from "./DitherPulseField"
export { DitherPixelFlood } from "./DitherPixelFlood"
export { DitherParticleBurst, type DitherParticleBurstHandle } from "./DitherParticleBurst"
export { DitherTypeStream } from "./DitherTypeStream"
export { DitherSpotlight } from "./DitherSpotlight"
export { DitherMagnetic } from "./DitherMagnetic"
export { DitherTilt } from "./DitherTilt"
export { DitherDissolve, type DitherDissolveHandle } from "./DitherDissolve"
export { DitherGlyphTrail } from "./DitherGlyphTrail"
export { DitherScanProgress } from "./DitherScanProgress"

// --- Newer interactive components (ported from the Vue kit) ---
export { DitherNumberFlow } from "./DitherNumberFlow"
export { DitherExpandTabs, type ExpandTab } from "./DitherExpandTabs"
export { DitherIsland } from "./DitherIsland"
export { DitherCardStack } from "./DitherCardStack"
export { DitherScrollProgress } from "./DitherScrollProgress"
export { DitherDock, type DockItem } from "./DitherDock"
export { DitherPreviewRail, type PreviewRailItem } from "./DitherPreviewRail"
export { DitherCommand, type CommandItem } from "./DitherCommand"
export { DitherVideoPlayer } from "./DitherVideoPlayer"
export { DitherBracket, type BracketMatch } from "./DitherBracket"
export { DitherSchedule, type ScheduleEvent } from "./DitherSchedule"
export { DitherInfiniteCanvas } from "./DitherInfiniteCanvas"
export { DitherSnapButton } from "./DitherSnapButton"
export { DitherExpandingArrow } from "./DitherExpandingArrow"
export { DitherSlideAction } from "./DitherSlideAction"
export { DitherHoldAction } from "./DitherHoldAction"
export { DitherWalletCard, type WalletAccount, type WalletAction } from "./DitherWalletCard"
export { DitherNotificationStack, type NotificationItem, type NotificationStackVariant } from "./DitherNotificationStack"
export { DitherGooeyMenu, type GooeyItem } from "./DitherGooeyMenu"

// --- dither-next-exclusive components (no Vue origin) ---
// Workspace / structure
export { DitherTreeView, type TreeViewNode } from "./DitherTreeView"
export { DitherSplitPane } from "./DitherSplitPane"
export { DitherKanban, type KanbanColumn } from "./DitherKanban"
export { DitherMiniMap } from "./DitherMiniMap"
// Data
export { DitherHeatCalendar, type DitherHeatValue } from "./DitherHeatCalendar"
export { DitherGauge, type DitherGaugeSegment } from "./DitherGauge"
// Inputs / fields
export { DitherTerminalPrompt } from "./DitherTerminalPrompt"
// Overlays
export { DitherRadialMenu, type RadialItem } from "./DitherRadialMenu"
// Media
export { DitherAudioWave } from "./DitherAudioWave"
// Navigation
export { DitherCarousel } from "./DitherCarousel"

// --- dither-next-exclusive components, batch 2 (no Vue origin) ---
// Inputs
export { DitherRangeSlider, type DitherRangeSliderProps } from "./DitherRangeSlider"
export { DitherSegmented, type SegmentItem, type DitherSegmentedProps } from "./DitherSegmented"
export { DitherTimePicker, type TimeValue, type DitherTimePickerProps } from "./DitherTimePicker"
export { DitherDropzone, type DitherDropzoneProps } from "./DitherDropzone"
// Display / data
export { DitherProgressRing, type DitherProgressRingProps } from "./DitherProgressRing"
export { DitherDataTable, type TableColumn, type DitherDataTableProps, type SortDir, type SortState } from "./DitherDataTable"
export { DitherCodeBlock, type DitherCodeBlockProps } from "./DitherCodeBlock"
export { DitherTicker, type TickerDirection, type DitherTickerProps } from "./DitherTicker"
// Overlays
export { DitherBottomSheet, type DitherBottomSheetProps } from "./DitherBottomSheet"
export { DitherHoverCard, type HoverCardSide, type HoverCardAlign, type DitherHoverCardProps } from "./DitherHoverCard"
// Structure
export { DitherVirtualList, type DitherVirtualListProps } from "./DitherVirtualList"

// --- dither-next-exclusive components, batch 3 (no Vue origin) ---
// Display / data
export { DitherDiffViewer, type DitherDiffViewerProps } from "./DitherDiffViewer"
export { DitherJsonTree, type DitherJsonTreeProps } from "./DitherJsonTree"
export { DitherCompare, type DitherCompareProps } from "./DitherCompare"
// Structure
export { DitherFlow, type DitherFlowProps, type DitherFlowNode, type DitherFlowEdge } from "./DitherFlow"
export { DitherMasonry, type DitherMasonryProps } from "./DitherMasonry"
// Navigation
export { DitherOutline, type DitherOutlineProps, type DitherOutlineItem } from "./DitherOutline"
// Inputs
export { DitherImageCropper, type DitherImageCropperProps, type DitherImageCropperHandle, type CropRect } from "./DitherImageCropper"
export { DitherShortcutRecorder, type DitherShortcutRecorderProps } from "./DitherShortcutRecorder"
// Overlays
export { DitherTour, type DitherTourProps, type DitherTourStep } from "./DitherTour"

// --- dither-next-exclusive components, batch 4 (no Vue origin) ---
// Display / data
export { DitherCalendarGrid, type DitherCalendarEvent, type DitherCalendarGridProps } from "./DitherCalendarGrid"
export { DitherSpreadsheet, type DitherSpreadsheetCell, type DitherSpreadsheetProps } from "./DitherSpreadsheet"
export { DitherMarkdownRender, type MarkdownComponents, type DitherMarkdownRenderProps } from "./DitherMarkdownRender"
// Structure
export { DitherOrgChart, type DitherOrgNode, type DitherOrgChartProps } from "./DitherOrgChart"
// Inputs
export { DitherMarkdownEditor, type DitherMarkdownEditorProps } from "./DitherMarkdownEditor"
export { DitherQueryBuilder, type DitherQueryFieldType, type DitherQueryField, type DitherQueryRule, type DitherQueryCombinator, type DitherQueryBuilderProps } from "./DitherQueryBuilder"
export { DitherColorPalette, type DitherSwatch, type DitherColorPaletteProps } from "./DitherColorPalette"
export { DitherFilterChip, type DitherFilterOption, type DitherFilterChipProps } from "./DitherFilterChip"
export { DitherSlider2D, type DitherSlider2DValue, type DitherSlider2DProps } from "./DitherSlider2D"
// Overlays
export { DitherCommandQueue, type QueueVariant, type QueuePosition, type QueueAction, type QueueToast, type DitherCommandQueueProps } from "./DitherCommandQueue"

// --- synced from upstream (2026-10): engine, stage & 3D worlds ---
export {
  DitherWorld,
  type DitherWorldProps,
  type DitherWorldHandle,
  createWorldGpu,
  createWorldMaterial,
  externalResources,
  formatOf,
  packTarget,
  packUv,
  paintMaterial,
  paintTarget,
  paintWorld,
  parseWorld,
  rasterizeWorld,
  sampleWorld,
  type ModelFormat,
  type World,
  type WorldGpu,
  type WorldMaterial,
  type WorldMesh,
  type WorldStyle,
  type WorldTarget,
  type WorldView,
} from "./DitherWorld"
export {
  DitherShader,
  type DitherShaderProps,
  type DitherShaderHandle,
  ditherShaderPixels,
  sampleShader,
  wrapShader,
  type ShaderChannel,
  type ShaderDither,
  type ShaderProgram,
} from "./DitherShader"
export { wrapMaterial } from "./shader"
export { bindChannel, createChannels, rasterOf, type ChannelInput, type Channels } from "./gl"
export { surfaceOf, type DitherSurface } from "./use-dither-background"
export {
  DitherStage,
  type DitherStageProps,
  STAGE,
  type StageContext,
} from "./DitherStage"
export { DitherLayer, type DitherLayerProps, type LayerSlot } from "./DitherLayer"
export {
  DitherContainer,
  type DitherContainerProps,
  type ContainerSlot,
} from "./DitherContainer"
export { DitherGrid, type DitherGridProps } from "./DitherGrid"
export {
  DitherSequence,
  type DitherSequenceProps,
} from "./DitherSequence"
export {
  DitherReveal,
  type DitherRevealProps,
  BAYER8,
  bayerMatrix,
  wipeStyle,
  type WipeDirection,
  type WipeOptions,
  type WipeStyle,
} from "./DitherReveal"
export {
  applyTheme,
  THEME_TOKENS,
  themeCss,
  themeVars,
  type ThemeInput,
  type ThemeToken,
  type ThemeVars,
} from "./theme"
export { linear, steps, frameSteps, frameIndex, cssSteps, type Easing, type StepPosition } from "./timing"
export { directFromHyperframes, directedTime, isDirected, onSeek, release, seek, type SeekListener } from "./clock"
export { planSequence, sampleSequence, staggerDelay } from "./sequence"
export type {
  SequenceNode,
  SequencePlan,
  ScheduledTrack,
  TrackNode,
  SerialNode,
  ParallelNode,
  StaggerNode,
  StaggerFrom,
  TrackSample,
  TrackState,
} from "./sequence"
export { CONTAINER_SCALE, resolveCq, quantize, type CqRange, type CqScale, type CqState } from "./containers"
export {
  compileTrack,
  keyframeTransform,
  LENGTH_UNITS,
  lerpTerms,
  parseAngle,
  parseLength,
  resolveSample,
  sampleKeyframes,
  termsToCss,
  termsToPx,
  type CompiledTrack,
  type CqBox,
  type KeyEasing,
  type Keyframe,
  type KeyframeSample,
  type KeyframeTrack,
  type Length,
  type LengthEnv,
  type LengthUnit,
  type Terms,
} from "./keyframes"
export { scoreCut, wavBytes, type ScoreAudio, type ScorePlan } from "./score"
export { copyText } from "./lib"

// --- synced from upstream (2026-10): primitives ---
export { DitherBox, type DitherBoxProps } from "./DitherBox"
export { DitherText, type DitherTextProps } from "./DitherText"
export { DitherDivider, type DitherDividerProps } from "./DitherDivider"
export { DitherVisuallyHidden, type DitherVisuallyHiddenProps } from "./DitherVisuallyHidden"
export { DitherSvg, type DitherSvgProps } from "./DitherSvg"
export { DitherImg, type DitherImgProps } from "./DitherImg"
export { DitherSpacer, type DitherSpacerProps } from "./DitherSpacer"
export { DitherPortal, type DitherPortalProps } from "./DitherPortal"
export { DitherOverlay, type DitherOverlayProps } from "./DitherOverlay"
export { DitherMeasure, type DitherMeasureProps } from "./DitherMeasure"
export { DitherClipboard, type DitherClipboardProps } from "./DitherClipboard"
export { DitherClickOutside, type DitherClickOutsideProps } from "./DitherClickOutside"
export { DitherFocusRing, type DitherFocusRingProps } from "./DitherFocusRing"
export { DitherFocusScope, type DitherFocusScopeProps } from "./DitherFocusScope"
export { DitherHoverArea, type DitherHoverAreaProps } from "./DitherHoverArea"
export { DitherPressable, type DitherPressableProps } from "./DitherPressable"
export { DitherInView, type DitherInViewProps } from "./DitherInView"
export { DitherIcon, type DitherIconProps } from "./DitherIcon"
export { DitherIconSet, type DitherIconSetProps } from "./DitherIconSet"
export { ICONS, ICON_NAMES, type IconName } from "./icons"

// --- synced from upstream (2026-10): typography ---
export { DitherHeading, type DitherHeadingProps } from "./DitherHeading"
export { DitherLabel, type DitherLabelProps } from "./DitherLabel"
export { DitherCaption, type DitherCaptionProps } from "./DitherCaption"
export { DitherOverline, type DitherOverlineProps } from "./DitherOverline"
export { DitherCode, type DitherCodeProps } from "./DitherCode"
export { DitherKbdCombo, type DitherKbdComboProps } from "./DitherKbdCombo"
export { DitherBlockquote, type DitherBlockquoteProps } from "./DitherBlockquote"
export { DitherHighlight, type DitherHighlightProps } from "./DitherHighlight"
export { DitherTruncate, type DitherTruncateProps } from "./DitherTruncate"
export { DitherLineClamp, type DitherLineClampProps } from "./DitherLineClamp"
export { DitherMiddleEllipsis, type DitherMiddleEllipsisProps } from "./DitherMiddleEllipsis"
export { DitherEllipsisTooltip, type DitherEllipsisTooltipProps } from "./DitherEllipsisTooltip"
export { DitherLink, type DitherLinkProps } from "./DitherLink"
export { DitherExternalLink, type DitherExternalLinkProps } from "./DitherExternalLink"
export { DitherSelectableText, type DitherSelectableTextProps } from "./DitherSelectableText"
export { DitherCopyableText, type DitherCopyableTextProps } from "./DitherCopyableText"

// --- synced from upstream (2026-10): formatters / time ---
export { DitherNumberText, type DitherNumberTextProps } from "./DitherNumberText"
export { DitherCurrencyText, type DitherCurrencyTextProps } from "./DitherCurrencyText"
export { DitherPercentText, type DitherPercentTextProps } from "./DitherPercentText"
export { DitherFileSizeText, type DitherFileSizeTextProps } from "./DitherFileSizeText"
export { DitherDurationText, type DitherDurationTextProps } from "./DitherDurationText"
export { DitherRelativeTime, type DitherRelativeTimeProps } from "./DitherRelativeTime"
export { DitherDateTimeText, type DitherDateTimeTextProps } from "./DitherDateTimeText"
export { DitherPluralText, type DitherPluralTextProps } from "./DitherPluralText"
export { DitherEmoji, type DitherEmojiProps } from "./DitherEmoji"

// --- synced from upstream (2026-10): forms pack ---
export { DitherPasswordInput, type DitherPasswordInputProps } from "./DitherPasswordInput"
export { DitherSearchInput, type DitherSearchInputProps } from "./DitherSearchInput"
export { DitherEmailInput, type DitherEmailInputProps } from "./DitherEmailInput"
export { DitherPhoneInput, type DitherPhoneInputProps } from "./DitherPhoneInput"
export { DitherCurrencyInput, type DitherCurrencyInputProps } from "./DitherCurrencyInput"
export { DitherScrubInput, type DitherScrubInputProps } from "./DitherScrubInput"
export { DitherHotkeyInput, type DitherHotkeyInputProps } from "./DitherHotkeyInput"
export { DitherCodeInput, type DitherCodeInputProps } from "./DitherCodeInput"
export { DitherInputGroup, type DitherInputGroupProps } from "./DitherInputGroup"
export { DitherInlineEdit, type DitherInlineEditProps } from "./DitherInlineEdit"
export { DitherTagInput, type DitherTagInputProps } from "./DitherTagInput"
export { DitherChoiceChips, type DitherChoiceChipsProps } from "./DitherChoiceChips"
export { DitherCheckboxCard, type DitherCheckboxCardProps } from "./DitherCheckboxCard"
export { DitherKeyValueInput, type DitherKeyValueInputProps, type DitherKeyValueRow } from "./DitherKeyValueInput"
export { DitherMentionInput, type DitherMentionInputProps } from "./DitherMentionInput"
export { DitherFileInput, type DitherFileInputProps } from "./DitherFileInput"
export { DitherListBox, type DitherListBoxProps } from "./DitherListBox"
export { DitherMultiSelect, type DitherMultiSelectProps } from "./DitherMultiSelect"
export { DitherCascadeSelect, type DitherCascadeSelectProps, type DitherCascadeNode } from "./DitherCascadeSelect"
export { DitherTransferList, type DitherTransferListProps } from "./DitherTransferList"
export { DitherLanguageSelect, type DitherLanguageSelectProps } from "./DitherLanguageSelect"
export { DitherIconPicker, type DitherIconPickerProps } from "./DitherIconPicker"
export { DitherFontPicker, type DitherFontPickerProps } from "./DitherFontPicker"
export { DitherCalendar, type DitherCalendarProps } from "./DitherCalendar"
export { DitherDatePicker, type DitherDatePickerProps } from "./DitherDatePicker"
export { DitherMonthPicker, type DitherMonthPickerProps } from "./DitherMonthPicker"
export { DitherColorSwatch, type DitherColorSwatchProps } from "./DitherColorSwatch"
export { DitherColorPicker, type DitherColorPickerProps } from "./DitherColorPicker"
export { DitherKnob, type DitherKnobProps } from "./DitherKnob"
export { DitherSignaturePad, type DitherSignaturePadProps } from "./DitherSignaturePad"