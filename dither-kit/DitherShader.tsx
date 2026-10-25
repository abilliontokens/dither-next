"use client";

// GLSL through the dither raster: Shadertoy-style `mainImage` or a raw
// `main()` compiled in an offscreen WebGL2/WebGL1 context at the cell
// resolution, read back and ordered-dithered on the CPU. iTime is the kit
// clock (so it seeks and renders), the pointer feeds iMouse, and up to four
// channels bind other kit surfaces, canvases, images or videos.
//
// React port of DitherShader.vue on the shared `useDitherBackground` runtime.
// The GPU half (context, program, uniforms, channel textures) is mutable
// per-mount state in a ref; the per-frame `draw` is recreated each render and
// read by the runtime through its options Box, so it always sees the latest
// props. `defineExpose({ surface })` becomes the `ref` handle.

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { directedTime } from "./clock";
import { buildProgram, type ChannelInput, type Channels, createChannels, createGl, type GlHandle } from "./gl";
import { cn } from "./lib";
import { BAYER4, clamp01, fillOf, type PixelColor, pixelMatrixFromSeed } from "./pixel";
import type { DitherRenderMode } from "./precompile";
import type { RasterBuffer } from "./raster";
import { ditherShaderPixels, sampleShader, SHADER_UNIFORMS, wrapShader, type ShaderDither } from "./shader";
import { useDitherBackground, type DitherSurface } from "./use-dither-background";

export type { ShaderDither, ShaderProgram } from "./shader";
export { ditherShaderPixels, sampleShader, wrapShader } from "./shader";

/** What `iChannelN` may be bound to: a kit surface (a component handle, its
 * exposed surface, or its canvas), or any canvas, image or video. */
export type ShaderChannel = ChannelInput;

/** What a `ref` on the component receives — Vue's `defineExpose({ surface })`;
 * pass it as another shader's or world's channel. */
export type DitherShaderHandle = { surface: DitherSurface };

export interface DitherShaderProps {
  /** URL of a .frag / .glsl file. */
  src?: string;
  /** Inline GLSL — Shadertoy `mainImage` or a raw `main`; wins over `src`. */
  source?: string;
  /** Up to four sources bound as `iChannel0..3`: other kit surfaces (pulled
   * at the same clock time), or any canvas, image or video. */
  channels?: ShaderChannel[];
  /** Tint of the mono mode, and `iColor` in the shader. */
  color?: PixelColor;
  /** A palette ramp, dark to light: luminance picks the band, the Bayer cell dithers between bands. */
  colors?: PixelColor[];
  /** Threshold luminance to 1 bit in `color` instead of keeping the shader's colours. */
  mono?: boolean;
  /** 0 smooth → 1 fully quantized. */
  dither?: number;
  /** Colour levels per channel (2 = the 8-colour look). */
  levels?: number;
  /** Mono: alpha floor of the unlit cells, 0-1. */
  shade?: number;
  /** Multiplies iTime. */
  speed?: number;
  /** Seeds the dither matrix, `iSeed`, and without src/source the sample shader. */
  seed?: number;
  /** Backing cell size in CSS px — bigger is chunkier. */
  cell?: number;
  /** Feed the pointer to iMouse. */
  interactive?: boolean;
  /** Accessible name. */
  label?: string;
  paused?: boolean;
  dpr?: number;
  /** Stop-motion cadence in fps (0 = smooth) — see timing.ts. */
  frameRate?: number;
  renderMode?: DitherRenderMode;
  className?: string;
  ref?: Ref<DitherShaderHandle>;
}

const MAX_COLS = 480;
const MAX_ROWS = 320;

type ShaderStatus = "ready" | "loading" | "error" | "unsupported";

/** The GPU half — per-mount mutable state, never rendered. */
type Gpu = {
  handle: GlHandle | null | undefined;
  program: WebGLProgram | null;
  compiled: string | null;
  locations: Partial<Record<(typeof SHADER_UNIFORMS)[number], WebGLUniformLocation | null>>;
  channelSet: Channels | null;
  pixels: Uint8Array;
};

export function DitherShader({
  src = "",
  source = "",
  channels,
  color = "blue",
  colors,
  mono = false,
  dither = 1,
  levels = 2,
  shade = 0,
  speed = 1,
  seed,
  cell = 3,
  interactive = true,
  label = "Shader",
  paused = false,
  dpr,
  frameRate = 0,
  renderMode = "live",
  className,
  ref,
}: DitherShaderProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Inline text and the seeded sample resolve before the first paint, as Vue's
  // immediate watcher did during setup; a URL is fetched by the effect below.
  const [code, setCode] = useState(() => source || (src ? "" : sampleShader(seed ?? 0)));
  const [status, setStatus] = useState<ShaderStatus>(() => (!source && src ? "loading" : "ready"));
  const [problem, setProblem] = useState("");
  const note =
    status === "loading"
      ? "loading shader"
      : status === "unsupported"
        ? "WebGL is not available"
        : status === "error"
          ? problem
          : "";

  // ---- source -----------------------------------------------------------------

  // Vue's watch([source, src, seed], load, { immediate: true }); the cleanup
  // aborts the previous fetch (Vue's `ctl?.abort()`), on change and unmount.
  useEffect(() => {
    if (source) {
      setCode(source);
      return;
    }
    if (!src) {
      setCode(sampleShader(seed ?? 0));
      return;
    }
    if (typeof fetch !== "function") {
      setStatus("error");
      setProblem("could not load the shader");
      return;
    }
    const c = new AbortController();
    setStatus("loading");
    fetch(src, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) => {
        if (c.signal.aborted) return;
        setStatus("ready");
        setCode(text);
      })
      .catch(() => {
        if (c.signal.aborted) return;
        setStatus("error");
        setProblem("could not load the shader");
        setCode("");
      });
    return () => c.abort();
  }, [source, src, seed]);

  // ---- the GPU half ---------------------------------------------------------------

  const gpuRef = useRef<Gpu | null>(null);
  const gpu = (gpuRef.current ??= {
    handle: undefined,
    program: null,
    compiled: null,
    locations: {},
    channelSet: null,
    pixels: new Uint8Array(0),
  });
  const mouseRef = useRef({ x: 0, y: 0, cx: 0, cy: 0, down: false });

  /** Build the program for `text`; sets `gpu.program` or the error note. */
  function compile(handle: GlHandle, text: string): void {
    const gl = handle.gl;
    if (gpu.program) gl.deleteProgram(gpu.program);
    gpu.program = null;
    gpu.locations = {};
    gpu.compiled = text;
    const built = wrapShader(text, handle.webgl2);
    if (built.version === 2 && !handle.webgl2) {
      setStatus("error");
      setProblem("this shader needs WebGL2");
      return;
    }
    const p = buildProgram(gl, built.vertex, built.fragment, ["p"]);
    if (typeof p === "string") {
      setStatus("error");
      setProblem(p);
      return;
    }
    gpu.program = p;
    for (const name of SHADER_UNIFORMS) gpu.locations[name] = gl.getUniformLocation(p, name);
    setStatus("ready");
    setProblem("");
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(p);
    for (let i = 0; i < 4; i++) {
      const loc = gpu.locations[`iChannel${i}` as "iChannel0"];
      if (loc) gl.uniform1i(loc, i);
    }
  }

  const ditherSpec = useMemo<ShaderDither>(
    () => ({
      matrix: seed !== undefined ? pixelMatrixFromSeed(seed) : BAYER4,
      dither: clamp01(dither),
      levels: Math.max(2, Math.round(levels)),
      mono: mono ? fillOf(color) : null,
      shade: clamp01(shade),
      palette: colors && colors.length >= 2 ? colors.map(fillOf) : null,
    }),
    [seed, dither, levels, mono, color, shade, colors],
  );

  function draw(buffer: RasterBuffer, clock: number, dt: number) {
    if (gpu.handle === undefined) gpu.handle = createGl();
    const handle = gpu.handle;
    if (!handle || handle.lost()) {
      buffer.data.fill(0);
      if (status === "ready") setStatus("unsupported");
      return;
    }
    if (!code) {
      buffer.data.fill(0);
      return;
    }
    if (gpu.compiled !== code) compile(handle, code);
    const program = gpu.program;
    if (!program) {
      buffer.data.fill(0);
      return;
    }
    const gl = handle.gl;
    const w = buffer.width;
    const h = buffer.height;
    handle.size(w, h);
    gl.useProgram(program);
    const t = clock * speed;
    const u = gpu.locations;
    const mouse = mouseRef.current;
    if (channels?.length) {
      const channelSet = (gpu.channelSet ??= createChannels(handle));
      const bound = channelSet.upload(channels, 0, t, directedTime());
      if (u.iChannelResolution) gl.uniform3fv(u.iChannelResolution, bound.res);
      if (u.iChannelTime) gl.uniform1fv(u.iChannelTime, bound.times);
    }
    const now = new Date();
    const [cr, cg, cb] = fillOf(color);
    if (u.iResolution) gl.uniform3f(u.iResolution, w, h, 1);
    if (u.iTime) gl.uniform1f(u.iTime, t);
    if (u.iTimeDelta) gl.uniform1f(u.iTimeDelta, dt);
    if (u.iFrame) gl.uniform1i(u.iFrame, Math.round(t * 60));
    if (u.iMouse)
      gl.uniform4f(u.iMouse, mouse.x * w, mouse.y * h, mouse.down ? mouse.cx * w : 0, mouse.down ? mouse.cy * h : 0);
    if (u.iDate) gl.uniform4f(u.iDate, now.getFullYear(), now.getMonth(), now.getDate(), t);
    if (u.iColor) gl.uniform3f(u.iColor, cr / 255, cg / 255, cb / 255);
    if (u.iSeed) gl.uniform1f(u.iSeed, seed ?? 0);
    if (u.resolution) gl.uniform2f(u.resolution, w, h);
    if (u.u_resolution) gl.uniform2f(u.u_resolution, w, h);
    if (u.time) gl.uniform1f(u.time, t);
    if (u.u_time) gl.uniform1f(u.u_time, t);
    if (u.mouse) gl.uniform2f(u.mouse, mouse.x, mouse.y);
    if (u.u_mouse) gl.uniform2f(u.u_mouse, mouse.x * w, mouse.y * h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gpu.pixels = handle.read(gpu.pixels);
    ditherShaderPixels(gpu.pixels, buffer, ditherSpec);
  }

  function pointer(e: ReactPointerEvent<HTMLDivElement>) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    const mouse = mouseRef.current;
    mouse.x = clamp01((e.clientX - box.left) / box.width);
    mouse.y = clamp01(1 - (e.clientY - box.top) / box.height);
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || e.button !== 0) return;
    pointer(e);
    const mouse = mouseRef.current;
    mouse.down = true;
    mouse.cx = mouse.x;
    mouse.cy = mouse.y;
    wrapRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onUp() {
    mouseRef.current.down = false;
  }

  // Unmount: release the program, the channel textures and the context. The
  // GPU half resets to "not yet created" so a StrictMode remount builds a
  // fresh context instead of drawing through a disposed one.
  useEffect(
    () => () => {
      if (gpu.handle) {
        if (gpu.program) gpu.handle.gl.deleteProgram(gpu.program);
        gpu.channelSet?.dispose();
      }
      gpu.handle?.dispose();
      gpu.handle = undefined;
      gpu.program = null;
      gpu.compiled = null;
      gpu.locations = {};
      gpu.channelSet = null;
    },
    [gpu],
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
      code,
      seed,
      color,
      colors,
      mono,
      dither,
      levels,
      shade,
      speed,
      channels,
    ],
    frameRate: () => frameRate,
    render: draw,
  });

  useImperativeHandle(ref, () => ({ surface }), [surface]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      data-state={status}
      className={cn("relative block h-full w-full overflow-hidden", className)}
      onPointerDown={onDown}
      onPointerMove={(e) => {
        if (interactive) pointer(e);
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
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

export default DitherShader;
