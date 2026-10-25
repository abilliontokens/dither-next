"use client";

// 3D models in the house raster: VRML97 / 1.0, X3D, glTF, OBJ (+ MTL), STL,
// PLY and OFF, by URL or inline, through the CPU z-buffer rasterizer or the
// WebGL engine, then one shared dither pass (ramp, grain, bloom, outlines),
// an optional GLSL material over the finished target, and channels as skins.
// The file's own animation plays on the kit clock, so it seeks and renders.
//
// React port of DitherWorld.vue on the shared `useDitherBackground` runtime.
// The engines (target, context, GPU rasterizer, material pass) are per-mount
// mutable state in a ref; the per-frame `paint` is recreated each render and
// read by the runtime through its options Box, so it always sees the latest
// props, model and orbit. `defineExpose({ surface })` becomes the `ref` handle.

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { directedTime } from "./clock";
import { type ChannelInput, createGl, type GlHandle, rasterOf } from "./gl";
import { cn } from "./lib";
import { externalResources, formatOf, parseWorld, type ModelFormat } from "./models";
import {
  BAYER4,
  clamp01,
  fillOf,
  type PixelBloomInput,
  type PixelColor,
  pixelBloomStyle,
  pixelMatrixFromSeed,
} from "./pixel";
import type { DitherRenderMode } from "./precompile";
import type { RasterBuffer } from "./raster";
import { useDitherBackground, type DitherSurface } from "./use-dither-background";
import {
  createWorldTarget,
  paintMaterial,
  paintTarget,
  rasterizeWorld,
  sampleWorld,
  type World,
  type WorldStyle,
  type WorldTarget,
  type WorldView,
} from "./world";
import { createWorldGpu, createWorldMaterial, type WorldGpu, type WorldMaterial } from "./world-gl";

export type { ModelFormat } from "./models";
export type { World, WorldMesh, WorldStyle, WorldTarget, WorldView } from "./world";
export type { WorldGpu, WorldMaterial } from "./world-gl";
export { externalResources, formatOf, parseWorld } from "./models";
export {
  packTarget,
  packUv,
  paintMaterial,
  paintTarget,
  paintWorld,
  rasterizeWorld,
  sampleWorld,
} from "./world";
export { createWorldGpu, createWorldMaterial } from "./world-gl";

/** What a `ref` on the component receives — Vue's `defineExpose({ surface })`;
 * pass it as a shader's or another world's channel. */
export type DitherWorldHandle = { surface: DitherSurface };

export interface DitherWorldProps {
  /** URL of a model: .wrl (VRML97 / 1.0), .x3d, .gltf / .glb, .obj (+ .mtl), .stl, .ply, .off. */
  src?: string;
  /** Inline model text (VRML, X3D, glTF JSON, OBJ, ASCII STL / PLY, OFF) — wins over `src`. */
  source?: string;
  /** File format; "auto" reads the name, then the bytes. */
  format?: ModelFormat | "auto";
  /** The file's up axis; "auto" is y, z for STL. */
  up?: "y" | "z" | "auto";
  /** Rasterizer: the CPU engine is byte-exact everywhere, the GPU engine
   * (WebGL) rasterizes big meshes fast; "auto" picks the GPU above ~40k triangles. */
  engine?: "auto" | "cpu" | "gpu";
  color?: PixelColor;
  /** A toon ramp, dark to light: lighting picks the band, the Bayer cell dithers between bands. */
  colors?: PixelColor[];
  /** Ramp mode: 0 smooth → 1 fully banded. */
  dither?: number;
  /** Seeds the dither matrix, the grain, and without src/source the sample world. */
  seed?: number;
  /** Backing cell size in CSS px — bigger is chunkier. */
  cell?: number;
  /** Orbit speed in degrees per second; 0 holds the pose. */
  autoRotate?: number;
  /** Camera angles in degrees; unset, the file's Viewpoint decides. */
  yaw?: number;
  pitch?: number;
  zoom?: number;
  /** Vertical field of view in degrees. */
  fov?: number;
  /** Alpha of the unlit dither cells inside the silhouette, 0-1. */
  shade?: number;
  /** Depth fade of the lighting, 0-1. */
  fog?: number;
  /** Noise grain over the model's own space, 0-1 (`noise.ts` fbm). */
  grain?: number;
  /** Grain frequency relative to the model's size. */
  grainScale?: number;
  /** Use the file's own colours instead of `color`. */
  material?: boolean;
  /** Draw polygon outlines, hidden lines removed. */
  wire?: boolean;
  /** A GLSL material over the finished target: `mainMaterial(out vec4, in
   * vec2)` reading dk_shade / dk_depth / dk_covered / dk_color / dk_uv per
   * cell and returning rgb + the shade the Bayer cell thresholds (needs WebGL). */
  shader?: string;
  /** Up to four sources — other kit surfaces (pulled at the same clock
   * time), canvases, images or videos. Without a shader the first wraps
   * the model through its texture coordinates (primitives, OBJ `vt`, glTF
   * `TEXCOORD_0`, VRML `TextureCoordinate`, PLY `s`/`t`) as its skin on
   * either engine; a shader reads them as `iChannel0..3` at `dk_uv(p)`. */
  channels?: ChannelInput[];
  /** Glow layer: a preset, a config, or a seed. */
  bloom?: PixelBloomInput;
  /** Play the file's own animations (VRML ROUTEs, glTF) on the kit clock. */
  animate?: boolean;
  /** Pin the animation to a moment in seconds instead of the clock. */
  time?: number;
  /** Drag, or arrow keys when focused, to orbit. */
  interactive?: boolean;
  /** Accessible name. */
  label?: string;
  paused?: boolean;
  dpr?: number;
  /** Stop-motion cadence in fps (0 = smooth) — see timing.ts. */
  frameRate?: number;
  renderMode?: DitherRenderMode;
  className?: string;
  ref?: Ref<DitherWorldHandle>;
}

const MAX_COLS = 480;
const MAX_ROWS = 320;
/** Above this many triangles "auto" prefers the GPU engine. */
const GPU_FROM = 40000;

type WorldStatus = "ready" | "loading" | "empty" | "error";

/** The engines — per-mount mutable state, never rendered. */
type Engines = {
  target: WorldTarget | null;
  /** undefined until first asked for; null when WebGL is unavailable. */
  gl: GlHandle | null | undefined;
  gpu: WorldGpu | null;
  materialPass: WorldMaterial | null;
};

function wantsGpu(engine: "auto" | "cpu" | "gpu", w: World): boolean {
  if (engine === "cpu") return false;
  if (engine === "gpu") return true;
  const triangles = w.meshes.reduce((n, m) => n + (m.kind === "faces" ? m.indices.length / 3 : 0), 0);
  return triangles >= GPU_FROM;
}

async function fetchModel(
  src: string,
  format: ModelFormat | "auto",
  up: "y" | "z" | undefined,
  signal: AbortSignal,
): Promise<World> {
  const head = await fetch(src, { signal });
  if (!head.ok) throw new Error(String(head.status));
  const bytes = await head.arrayBuffer();
  const fmt = format === "auto" ? (formatOf(src) ?? "auto") : format;
  const resources: Record<string, ArrayBuffer> = {};
  const base = typeof location !== "undefined" ? new URL(src, location.href) : new URL(src);
  await Promise.all(
    externalResources(bytes, fmt).map(async (uri) => {
      try {
        const r = await fetch(new URL(uri, base).href, { signal });
        if (r.ok) resources[uri] = await r.arrayBuffer();
      } catch {
        // A missing side file costs its colours or buffers, not the model.
      }
    }),
  );
  return parseWorld(bytes, fmt, { up, resources });
}

export function DitherWorld({
  src = "",
  source = "",
  format = "auto",
  up = "auto",
  engine = "auto",
  color = "blue",
  colors,
  dither = 1,
  seed,
  cell = 3,
  autoRotate = 12,
  yaw,
  pitch,
  zoom,
  fov = 40,
  shade = 0.18,
  fog = 0.3,
  grain = 0,
  grainScale = 4,
  material = false,
  wire = false,
  shader = "",
  channels,
  bloom = "off",
  animate = true,
  time,
  interactive = true,
  label = "3D model",
  paused = false,
  dpr,
  frameRate = 0,
  renderMode = "live",
  className,
  ref,
}: DitherWorldProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const [model, setModel] = useState<{ world: World | null; status: WorldStatus }>(() => ({
    world: null,
    status: !source && src ? "loading" : "ready",
  }));
  const world = model.world;
  const [engineUsed, setEngineUsed] = useState<"cpu" | "gpu">("cpu");
  const [gpuProblem, setGpuProblem] = useState("");
  const [materialProblem, setMaterialProblem] = useState("");
  const note =
    model.status === "loading"
      ? "loading model"
      : model.status === "error"
        ? "could not load the model"
        : model.status === "empty"
          ? "no geometry"
          : engine === "gpu" && gpuProblem
            ? gpuProblem
            : shader && materialProblem
              ? materialProblem
              : "";

  // ---- loading ----------------------------------------------------------------

  // Vue's watch([source, src, format, up, seed], load, { immediate: true });
  // the cleanup aborts the previous fetch (Vue's `ctl?.abort()`), on change
  // and on unmount.
  useEffect(() => {
    const upAxis = up === "auto" ? undefined : up;
    const setWorld = (w: World) => setModel({ world: w, status: w.meshes.length ? "ready" : "empty" });
    const fail = () => setModel({ world: null, status: "error" });
    try {
      if (source) return setWorld(parseWorld(source, format, { up: upAxis }));
      if (!src) return setWorld(parseWorld(sampleWorld(seed ?? 0), "vrml"));
    } catch {
      return fail();
    }
    if (typeof fetch !== "function") return fail();
    const c = new AbortController();
    setModel((m) => ({ world: m.world, status: "loading" }));
    fetchModel(src, format, upAxis, c.signal)
      .then((w) => {
        if (!c.signal.aborted) setWorld(w);
      })
      .catch(() => {
        if (!c.signal.aborted) fail();
      });
    return () => c.abort();
  }, [source, src, format, up, seed]);

  // ---- the camera -------------------------------------------------------------

  /** Where the file's Viewpoint stood, as orbit angles, when the props leave it open. */
  const pose = useMemo(() => {
    const vp = world?.viewpoint;
    if (!world || !vp) return { yaw: 30, pitch: 20, zoom: 1 };
    const dx = vp.position[0] - world.center[0];
    const dy = vp.position[1] - world.center[1];
    const dz = vp.position[2] - world.center[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return { yaw: 30, pitch: 20, zoom: 1 };
    const f = (Math.min(150, Math.max(5, fov)) * Math.PI) / 180;
    return {
      yaw: (Math.atan2(-dx, dz) * 180) / Math.PI,
      pitch: (Math.asin(Math.max(-1, Math.min(1, dy / d))) * 180) / Math.PI,
      zoom: Math.max(0.3, Math.min(4, ((world.radius / Math.sin(f / 2)) * 1.08) / d)),
    };
  }, [world, fov]);

  /** Pointer and keyboard orbit, added on top of the props. */
  const [orbit, setOrbit] = useState({ yaw: 0, pitch: 0 });

  const worldStyle = useMemo<WorldStyle>(
    () => ({
      fill: fillOf(color),
      matrix: seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4,
      shade: clamp01(shade),
      material,
      wire,
      fog: clamp01(fog),
      ramp: colors && colors.length >= 2 ? colors.map(fillOf) : null,
      dither: clamp01(dither),
      grain: clamp01(grain),
      grainScale: Math.max(0.1, grainScale),
      seed: seed ?? 0,
    }),
    [color, seed, shade, material, wire, fog, colors, dither, grain, grainScale],
  );

  const bloomStyle = useMemo(() => pixelBloomStyle(bloom), [bloom]);

  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    wrapRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    // A drag across the whole width turns half a revolution.
    const k = 180 / Math.max(1, wrapRef.current?.getBoundingClientRect().width ?? 320);
    const dYaw = (e.clientX - d.x) * k;
    const dPitch = (e.clientY - d.y) * k;
    setOrbit((o) => ({ yaw: o.yaw + dYaw, pitch: o.pitch + dPitch }));
    d.x = e.clientX;
    d.y = e.clientY;
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    const step = e.shiftKey ? 30 : 10;
    if (e.key === "ArrowLeft") setOrbit((o) => ({ ...o, yaw: o.yaw - step }));
    else if (e.key === "ArrowRight") setOrbit((o) => ({ ...o, yaw: o.yaw + step }));
    else if (e.key === "ArrowUp") setOrbit((o) => ({ ...o, pitch: o.pitch + step }));
    else if (e.key === "ArrowDown") setOrbit((o) => ({ ...o, pitch: o.pitch - step }));
    else if (e.key === "Home") setOrbit({ yaw: 0, pitch: 0 });
    else return;
    e.preventDefault();
  }

  // ---- the engines --------------------------------------------------------------

  const enginesRef = useRef<Engines | null>(null);
  const engines = (enginesRef.current ??= { target: null, gl: undefined, gpu: null, materialPass: null });

  /** One WebGL context per component, shared by the GPU engine and the material
   * pass — created on first use, null for good once WebGL proved unavailable. */
  function glHandle(): GlHandle | null {
    if (engines.gl === undefined) engines.gl = createGl();
    return engines.gl;
  }

  function paint(buffer: RasterBuffer, clock: number) {
    const w = world;
    if (!w) {
      buffer.data.fill(0);
      return;
    }
    const v: WorldView = {
      yaw: (yaw ?? pose.yaw) + orbit.yaw + autoRotate * clock,
      pitch: Math.max(-89, Math.min(89, (pitch ?? pose.pitch) + orbit.pitch)),
      zoom: zoom ?? pose.zoom,
      fov,
      time: animate ? (time ?? clock) : 0,
    };
    let target = engines.target;
    if (!target || target.width !== buffer.width || target.height !== buffer.height)
      target = engines.target = createWorldTarget(buffer.width, buffer.height);
    let drawn = false;
    if (wantsGpu(engine, w)) {
      const h = glHandle();
      if (h) {
        const gpu = (engines.gpu ??= createWorldGpu(h));
        drawn = gpu.rasterize(w, v, target, worldStyle);
        setGpuProblem(drawn ? "" : gpu.problem());
      } else setGpuProblem("WebGL is not available");
    }
    if (!drawn) rasterizeWorld(w, v, target, worldStyle);
    setEngineUsed(drawn ? "gpu" : "cpu");
    const moment = directedTime();
    if (shader) {
      const h = glHandle();
      const rgba = h
        ? (engines.materialPass ??= createWorldMaterial(h)).shade(shader, target, w, v, {
            time: v.time ?? 0,
            color: fillOf(color),
            seed: seed ?? 0,
            channels,
            moment,
          })
        : null;
      setMaterialProblem(
        rgba
          ? ""
          : h
            ? engines.materialPass?.problem() || "the material did not compile"
            : "WebGL is not available",
      );
      if (rgba) {
        paintMaterial(buffer, target, w, v, worldStyle, rgba);
        return;
      }
    }
    // The first channel is the model's skin: sampled per cell through the uvs.
    const texture = channels?.length ? rasterOf(channels[0], moment) : null;
    paintTarget(buffer, target, w, v, texture ? { ...worldStyle, texture } : worldStyle);
  }

  function afterPaint(canvas: HTMLCanvasElement) {
    const glow = bloomRef.current;
    const ctx = glow?.getContext("2d");
    if (!glow || !ctx) return;
    if (glow.width !== canvas.width || glow.height !== canvas.height) {
      glow.width = canvas.width;
      glow.height = canvas.height;
    }
    ctx.clearRect(0, 0, glow.width, glow.height);
    ctx.drawImage(canvas, 0, 0);
  }

  // Unmount: release the engines and the shared context. The context resets to
  // "not yet created" so a StrictMode remount builds a fresh one instead of
  // drawing through a disposed one.
  useEffect(
    () => () => {
      engines.gpu?.dispose();
      engines.gpu = null;
      engines.materialPass?.dispose();
      engines.materialPass = null;
      engines.gl?.dispose();
      engines.gl = undefined;
    },
    [engines],
  );

  const surface = useDitherBackground({
    wrapRef,
    canvasRef,
    cell: () => Math.max(1, cell),
    maxCols: MAX_COLS,
    maxRows: MAX_ROWS,
    dpr: () => dpr,
    paused: () => paused,
    renderMode: () => renderMode,
    precompiled: () => undefined,
    restart: () => [
      renderMode,
      dpr,
      cell,
      world,
      orbit.yaw,
      orbit.pitch,
      engine,
      yaw,
      pitch,
      zoom,
      fov,
      color,
      colors,
      dither,
      seed,
      shade,
      fog,
      grain,
      grainScale,
      material,
      wire,
      shader,
      bloom,
      animate,
      time,
      channels,
    ],
    frameRate: () => frameRate,
    staticClock: 0,
    render: paint,
    afterPaint,
  });

  useImperativeHandle(ref, () => ({ surface }), [surface]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      data-state={model.status}
      data-engine={engineUsed}
      className={cn(
        "relative block h-full w-full select-none overflow-hidden",
        interactive && "cursor-grab active:cursor-grabbing",
        className,
      )}
      style={interactive ? { touchAction: "pan-y" } : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {bloomStyle ? (
        <canvas
          ref={bloomRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            filter: bloomStyle.filter,
            opacity: bloomStyle.opacity,
            mixBlendMode: bloomStyle.mixBlendMode,
            imageRendering: bloomStyle.imageRendering,
          }}
        />
      ) : null}
      {note ? (
        <p
          className="absolute inset-x-0 bottom-2 px-2 text-center font-mono text-[10px] break-words text-muted-foreground"
          aria-live="polite"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

export default DitherWorld;
