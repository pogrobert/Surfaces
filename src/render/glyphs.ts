import { positions } from "../core/type.ts"
import type { Font } from "../core/type.ts"
import type { TextLayer } from "../core/scene.ts"
import { OUTLINES } from "../type/outlines.ts"

// A title as the outlines of its face, for a PNG: one path, the same pixels
// on every machine, with no font installed anywhere. Only the PNG export
// imports this, so the outlines stay out of every page's bundle.

type Contour = { x: number; y: number; on: boolean }[]
const glyphs = new Map<Font, Map<number, Contour[]>>()

function glyphsOf(font: Font) {
  let found = glyphs.get(font)
  if (!found) {
    found = new Map()
    for (const entry of OUTLINES[font].split("|")) {
      const [code, body] = entry.split(":")
      let x = 0
      let y = 0
      const contours = body!.split(";").map((contour) =>
        contour.split(" ").map((step) => {
          const on = !step.startsWith("~")
          const [dx, dy] = step.replace("~", "").split(",").map(Number) as [number, number]
          x += dx
          y += dy
          return { x, y, on }
        })
      )
      found.set(parseInt(code!, 36), contours)
    }
    glyphs.set(font, found)
  }
  return found
}

const n = (value: number) => String(Math.round(value * 10) / 10)

// One contour as path steps: quadratic curves through its off-curve points,
// with the on-curve point between two of them implied, as TrueType has it.
function contourPath(points: Contour, at: (x: number, y: number) => [number, number]) {
  const count = points.length
  const point = (i: number) => points[((i % count) + count) % count]!
  const mid = (a: Contour[number], b: Contour[number]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true })
  const first = points.findIndex((p) => p.on)
  const start = first >= 0 ? point(first) : mid(point(0), point(1))
  const from = first >= 0 ? first : 0
  const [sx, sy] = at(start.x, start.y)
  let d = `M${n(sx)} ${n(sy)}`
  for (let k = 1; k <= count; k++) {
    const p = point(from + k)
    if (p.on) {
      const [x, y] = at(p.x, p.y)
      d += `L${n(x)} ${n(y)}`
      continue
    }
    const next = point(from + k + 1)
    const end = next.on ? next : mid(p, next)
    const [cx, cy] = at(p.x, p.y)
    const [x, y] = at(end.x, end.y)
    d += `Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`
    if (next.on) k++
  }
  return `${d}Z`
}

export function outlinePath(layer: TextLayer) {
  const table = glyphsOf(layer.font)
  const scale = layer.size / 1000
  let d = ""
  for (const line of layer.lines) {
    const left = line.x - (layer.align === "start" ? 0 : layer.align === "end" ? line.width : line.width / 2)
    for (const { code, x } of positions(line.text, layer.font)) {
      const origin = left + x * layer.size
      const at = (gx: number, gy: number): [number, number] => [origin + gx * scale, line.y - gy * scale]
      for (const contour of table.get(code) ?? []) d += contourPath(contour, at)
    }
  }
  return d
}
