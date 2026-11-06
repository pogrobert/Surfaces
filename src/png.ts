import type { Scene } from "./core/scene.ts"
import { outlinePath } from "./render/glyphs.ts"
import { encodeJpeg } from "./render/jpeg.ts"
import { toSvg } from "./render/svg.ts"

// PNG export, for OG images and anywhere an SVG won't do. Place content with
// the scene's own `areas`, which are in the same pixels, or give the input a
// `title`, which is drawn here from the face's own outlines. It goes through
// resvg, which the caller installs: the core has no dependencies, and this
// file only loads it when a PNG is asked for.
//
// The native build, @resvg/resvg-js, is the fastest, and runs on Node. Where
// a native module can't load (an edge runtime, a Cloudflare Worker, a sandbox
// in the browser such as StackBlitz), the WebAssembly build,
// @resvg/resvg-wasm, draws the same picture. On Node it is found by itself;
// elsewhere pass its module, which those runtimes only allow imported ahead:
//
//   import wasm from "@resvg/resvg-wasm/index_bg.wasm"
//   await toPng(scene, { wasm })

type Resvg = new (
  svg: string,
  options: { fitTo: { mode: "width"; value: number }; font?: { loadSystemFonts: boolean } }
) => { render(): { asPng(): Uint8Array; pixels: Uint8Array; width: number; height: number } }

// What resvg's WebAssembly can start from: the compiled module, its bytes, or
// a fetch of them.
export type WasmSource = WebAssembly.Module | ArrayBuffer | Uint8Array | Response | Promise<Response>

export type PngOptions = {
  // Pixels across; the scene's own size by default.
  width?: number
  wasm?: WasmSource
}

const NATIVE = "@resvg/resvg-js"
const WASM = "@resvg/resvg-wasm"
const HOW = `PNG export needs resvg. On Node, install ${NATIVE} (fastest) or ${WASM}. On an edge runtime or a worker, install ${WASM} and pass its module: import wasm from "${WASM}/index_bg.wasm", then toPng(scene, { wasm }).`

let native: Promise<Resvg> | undefined
let wasm: Promise<Resvg> | undefined

// The names are held in variables so bundlers leave the imports alone when
// nobody asks for a PNG.
function loadNative() {
  const name = NATIVE
  native ??= import(name).then(
    (module: { Resvg: Resvg }) => module.Resvg,
    (error) => {
      native = undefined
      throw error
    }
  )
  return native
}

// resvg's WebAssembly starts once per process, from whatever it is given.
function loadWasm(source: WasmSource | Promise<WasmSource>) {
  const name = WASM
  wasm ??= import(name).then(
    async (module: { Resvg: Resvg; initWasm(source: unknown): Promise<void> }) => {
      await module.initWasm(await source)
      return module.Resvg
    },
    (error) => {
      wasm = undefined
      throw error
    }
  )
  return wasm
}

// The WebAssembly's bytes from the installed package, on Node.
async function wasmOnDisk(): Promise<Uint8Array> {
  const fs = "node:fs/promises"
  const nodeModule = "node:module"
  const { readFile } = await import(fs)
  const { createRequire } = await import(nodeModule)
  return readFile(createRequire(import.meta.url).resolve(`${WASM}/index_bg.wasm`))
}

async function renderer(source?: WasmSource): Promise<Resvg> {
  if (source) return loadWasm(source).catch(() => Promise.reject(new Error(HOW)))
  if (wasm) return wasm
  try {
    return await loadNative()
  } catch {
    try {
      return await loadWasm(wasmOnDisk())
    } catch {
      wasm = undefined
      throw new Error(HOW)
    }
  }
}

async function render(scene: Scene, { width, wasm: source }: PngOptions) {
  oneTheme(scene)
  const Resvg = await renderer(source)
  const svg = toSvg(scene, { target: "resvg", outlines: outlinePath })
  return new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(width ?? scene.output.w) },
    font: { loadSystemFonts: false },
  }).render()
}

// Drawn at the size the scene was asked for, or `width` pixels wide.
export async function toPng(scene: Scene, options: PngOptions = {}) {
  return (await render(scene, options)).asPng()
}

// The same picture as a JPEG, for link previews: grain is noise, which a PNG
// can't squeeze, so a grainy cover is a megabyte as a PNG and a fraction of
// that as a JPEG, under what chat apps will show as a preview. `quality`
// runs from 1 to 100; the default keeps a title's edges clean.
export async function toJpeg(scene: Scene, { quality = 86, ...options }: PngOptions & { quality?: number } = {}) {
  const image = await render(scene, options)
  return encodeJpeg(image.pixels, image.width, image.height, quality)
}

// In a browser the page draws the SVG itself, every filter included, so a PNG
// needs nothing installed.
// A picture has one theme; a cover drawn for both has to say which.
function oneTheme(scene: Scene) {
  if (scene.dark) throw new Error('A PNG has one theme: generate with theme "light" or "dark", not "auto"')
}

export async function toPngInBrowser(
  scene: Scene,
  { width }: { width?: number } = {}
): Promise<Blob> {
  oneTheme(scene)
  const w = Math.round(width ?? scene.output.w)
  const h = Math.round((w * scene.output.h) / scene.output.w)
  const url = URL.createObjectURL(
    new Blob([toSvg(scene, { outlines: outlinePath })], { type: "image/svg+xml" })
  )
  try {
    const image = new Image(w, h)
    image.src = url
    await image.decode()
    const canvas = new OffscreenCanvas(w, h)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("This browser can't draw to a canvas")
    context.drawImage(image, 0, 0, w, h)
    return await canvas.convertToBlob({ type: "image/png" })
  } finally {
    URL.revokeObjectURL(url)
  }
}
