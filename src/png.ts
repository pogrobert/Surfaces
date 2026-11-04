import type { Scene } from "./core/scene.ts"
import { toSvg } from "./render/svg.ts"

// PNG export, for OG images and anywhere an SVG won't do. Place content with
// the scene's own `areas`, which are in the same pixels. On a server it goes
// through resvg, which the caller installs: the core has no dependencies, and
// this file only loads it when a PNG is asked for.

type Resvg = new (
  svg: string,
  options: { fitTo: { mode: "width"; value: number }; font?: { loadSystemFonts: boolean } }
) => { render(): { asPng(): Uint8Array } }

let loading: Promise<Resvg> | undefined

async function resvg(): Promise<Resvg> {
  // The name is held in a variable so bundlers leave the import alone when
  // nobody asks for a PNG.
  const name = "@resvg/resvg-js"
  loading ??= import(name).then(
    (module: { Resvg: Resvg }) => module.Resvg,
    () => {
      loading = undefined
      throw new Error(
        `PNG export on a server needs resvg: install ${name} next to @pogrobert/surfaces`
      )
    }
  )
  return loading
}

// Drawn at the size the scene was asked for, or `width` pixels wide.
export async function toPng(scene: Scene, { width }: { width?: number } = {}) {
  oneTheme(scene)
  const Resvg = await resvg()
  const svg = toSvg(scene, { target: "resvg" })
  return new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(width ?? scene.output.w) },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng()
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
    new Blob([toSvg(scene)], { type: "image/svg+xml" })
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
