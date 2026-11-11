// What the page needs to set words over art it does not keep clear: the ink
// that reads best on the art behind them, and how strong a halo round the
// letters has to be for them to read, from none where the art is calm enough
// to full where it is busy. The art is drawn small to a canvas, as the reader
// sees it, and the pixels under the words are read with the contrast formula
// of WCAG: the halo is only as strong as the weakest twentieth of them needs.
import { generate, toSvg } from "@pogrobert/surfaces"
import type { SurfaceInput } from "@pogrobert/surfaces"

export type Behind = { ink: string; glow: string; halo: number }
type Box = { x: number; y: number; w: number; h: number }

export const DARK_INK = "#0e1622"
export const LIGHT_INK = "#f7f6f2"
// Contrast enough for large text to read with nothing behind it; under this,
// a halo grows until at 2:1 it is full.
const ENOUGH = 7
const LEAST = 2

// The sRGB channel in linear light, then the luminance WCAG weighs.
const linear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const hex = (h: string) => luminance(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16))
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// The twentieth of pixels that read worst, as a contrast against `ink`.
function weakest(levels: Float32Array, ink: number) {
  const each = Array.from(levels, (level) => contrast(level, ink)).sort((a, b) => a - b)
  return each[Math.floor(each.length * 0.05)] ?? ENOUGH
}

const read = new Map<string, Behind>()

export async function behind(input: SurfaceInput, ratio: number, box: Box, dark: boolean): Promise<Behind> {
  const key = JSON.stringify([input, ratio.toFixed(2), box, dark])
  const known = read.get(key)
  if (known) return known
  // The same drawing at a size a canvas reads quickly: the art follows the
  // shape, not the size.
  const W = 320
  const H = Math.max(40, Math.round(W / ratio))
  const scene = generate({ ...input, theme: dark ? "dark" : "light", width: 1200, height: Math.round(1200 / ratio), motion: "none" })
  const url = URL.createObjectURL(new Blob([toSvg(scene)], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    context.drawImage(img, 0, 0, W, H)
    const x = Math.max(0, Math.floor(box.x * W)), y = Math.max(0, Math.floor(box.y * H))
    const w = Math.max(1, Math.min(W - x, Math.ceil(box.w * W))), h = Math.max(1, Math.min(H - y, Math.ceil(box.h * H)))
    const { data } = context.getImageData(x, y, w, h)
    const levels = new Float32Array(data.length / 4)
    for (let i = 0; i < levels.length; i++) levels[i] = luminance(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)
    const onDark = weakest(levels, hex(DARK_INK))
    const onLight = weakest(levels, hex(LIGHT_INK))
    const darkWins = onDark >= onLight
    const worst = darkWins ? onDark : onLight
    const result: Behind = {
      ink: darkWins ? DARK_INK : LIGHT_INK,
      glow: darkWins ? LIGHT_INK : DARK_INK,
      halo: worst >= ENOUGH ? 0 : Math.min(1, (ENOUGH - worst) / (ENOUGH - LEAST)),
    }
    if (read.size > 100) read.clear()
    read.set(key, result)
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A halo that follows the letters: layers of the ground colour, close and
// then wider, each as strong as the art needs. None at all where it reads.
// Small text, thinner strokes on the same art, gets more of it.
export function halo({ glow, halo: measured }: Behind, small = false) {
  if (measured < 0.03) return "none"
  const strength = small ? Math.min(1, measured * 1.8 + 0.15) : measured
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(glow.slice(i, i + 2), 16))
  const at = (alpha: number) => `rgb(${r} ${g} ${b} / ${(alpha * strength).toFixed(3)})`
  return [`0 0 1px ${at(0.9)}`, `0 0 4px ${at(0.8)}`, `0 0 12px ${at(0.6)}`, `0 0 28px ${at(0.45)}`].join(", ")
}
