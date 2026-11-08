import type { Scene } from "./core/scene.ts"
import { outlinePath } from "./render/glyphs.ts"
import { rasterize } from "./raster.ts"
import type { WasmSource } from "./raster.ts"
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

export type { WasmSource }

export type PngOptions = {
  // Pixels across; the scene's own size by default.
  width?: number
  wasm?: WasmSource
}

// The most pixels a picture is drawn with: 4096 by 4096, or a 3000 square
// podcast cover, in about 70 MB. More would run a server out of memory.
const MOST_PIXELS = 4096 * 4096

async function render(scene: Scene, { width, wasm }: PngOptions, format: "PNG" | "JPEG") {
  if (!scene || typeof scene !== "object" || !scene.output || !Array.isArray(scene.layers)) {
    throw new Error(`Expected a scene, as generate() or brand.og() return: to${format === "PNG" ? "Png" : "Jpeg"}(brand.og({ title }))`)
  }
  oneTheme(scene, format)
  const w = Math.round(width ?? scene.output.w)
  const h = Math.round((w * scene.output.h) / scene.output.w)
  if (!Number.isFinite(w) || w < 16) throw new Error(`"width" is how many pixels across, 16 or more; got ${width}`)
  if (w * h > MOST_PIXELS) throw new Error(`A ${format} ${w} by ${h} is more than a picture needs, and more memory than a server has to spare; keep it to ${Math.floor(MOST_PIXELS / 1e6)} megapixels, such as ${Math.floor(Math.sqrt(MOST_PIXELS * (w / h)))} wide`)
  return rasterize(toSvg(scene, { target: "resvg", outlines: outlinePath }), w, wasm)
}

// Drawn at the size the scene was asked for, or `width` pixels wide.
export async function toPng(scene: Scene, options: PngOptions = {}) {
  return (await render(scene, options, "PNG")).asPng()
}

// The same picture as a JPEG, for link previews: grain is noise, which a PNG
// can't squeeze, so a grainy cover is a megabyte as a PNG and a fraction of
// that as a JPEG, under what chat apps will show as a preview. `quality`
// runs from 1 to 100; the default keeps a title's edges clean.
export async function toJpeg(scene: Scene, { quality = 86, ...options }: PngOptions & { quality?: number } = {}) {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error(`"quality" runs from 1 to 100; got ${quality}`)
  const image = await render(scene, options, "JPEG")
  return encodeJpeg(image.pixels, image.width, image.height, quality)
}

// In a browser the page draws the SVG itself, every filter included, so a PNG
// needs nothing installed.
// A picture has one theme; a cover drawn for both has to say which.
function oneTheme(scene: Scene, format: "PNG" | "JPEG" = "PNG") {
  if (scene.dark) throw new Error(`A ${format} has one theme: draw it with theme "light" or "dark", not "auto"`)
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
