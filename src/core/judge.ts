import { contrast, parseHex } from "./color.ts"
import { clamp, cos, radians, sin } from "./math.ts"
import { poolAlpha } from "./scene.ts"
import type {
  Layer,
  Paint,
  Pool,
  Scene,
  Shape,
  Stop,
  Tone,
} from "./scene.ts"
import { boxesTouch } from "../layouts/geometry.ts"
import { logoColours } from "./image.ts"

// The judge: what makes a cover good enough to show, checked from the scene
// alone. Hand-built styles are held to it by the tests; the grammar's
// combinations are held to it before any of them is offered (see
// test/grammar.test.ts), so a combination is only as open as it is judged.
//
// It works out what a scene shows at a point from the data alone, without a
// rasteriser, so it runs in plain Node, as fast as a test needs. Grain
// is left out: film grain averages to no change, and a stipple is taken at its
// mean coverage, and a blur at its colours before they smear; whatever sits
// over a blur still counts. The contact sheet measures real pixels on top of
// this.

type Rgb = [number, number, number]

const blend = (under: Rgb, over: Rgb, alpha: number): Rgb => [
  under[0] + (over[0] - under[0]) * alpha,
  under[1] + (over[1] - under[1]) * alpha,
  under[2] + (over[2] - under[2]) * alpha,
]

function inPolygon(points: number[], x: number, y: number) {
  let inside = false
  const count = points.length / 2
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2]!
    const yi = points[i * 2 + 1]!
    const xj = points[j * 2]!
    const yj = points[j * 2 + 1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// Ribbons are checked against a box first: a page of them is thousands of
// segments, and most points are nowhere near most lines.
const ribbonBoxes = new WeakMap<number[], [number, number, number, number]>()

function inRibbon(points: number[], x: number, y: number) {
  let box = ribbonBoxes.get(points)
  if (!box) {
    box = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = 0; i < points.length; i += 3) {
      const half = points[i + 2]!
      box[0] = Math.min(box[0], points[i]! - half)
      box[1] = Math.min(box[1], points[i + 1]! - half)
      box[2] = Math.max(box[2], points[i]! + half)
      box[3] = Math.max(box[3], points[i + 1]! + half)
    }
    ribbonBoxes.set(points, box)
  }
  if (x < box[0] || y < box[1] || x > box[2] || y > box[3]) return false
  for (let i = 0; i + 3 < points.length; i += 3) {
    const ax = points[i]!
    const ay = points[i + 1]!
    const dx = points[i + 3]! - ax
    const dy = points[i + 4]! - ay
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    const half = points[i + 2]! + (points[i + 5]! - points[i + 2]!) * t
    const px = x - (ax + dx * t)
    const py = y - (ay + dy * t)
    if (px * px + py * py <= half * half) return true
  }
  return false
}

function contains(shape: Shape, x: number, y: number) {
  switch (shape.type) {
    case "rect":
      return (
        x >= shape.x &&
        x <= shape.x + shape.w &&
        y >= shape.y &&
        y <= shape.y + shape.h
      )
    case "circle": {
      const dx = x - shape.cx
      const dy = y - shape.cy
      return dx * dx + dy * dy <= shape.r * shape.r
    }
    case "ellipse": {
      const dx = (x - shape.cx) / shape.rx
      const dy = (y - shape.cy) / shape.ry
      return dx * dx + dy * dy <= 1
    }
    case "ring": {
      const dx = x - shape.cx
      const dy = y - shape.cy
      const d = dx * dx + dy * dy
      return d <= shape.r * shape.r && d >= shape.inner * shape.inner
    }
    case "polygon":
      return inPolygon(shape.points, x, y)
    case "ribbon":
      return inRibbon(shape.points, x, y)
    case "blocks":
      for (let i = 0; i < shape.points.length; i += 3) {
        const left = shape.points[i]!
        const top = shape.points[i + 1]!
        if (x >= left && x <= left + shape.points[i + 2]! && y >= top && y <= top + shape.h) {
          return true
        }
      }
      return false
  }
}

function alongStops(stops: Stop[], at: number) {
  const t = clamp(at, 0, 1)
  const after = stops.findIndex((stop) => stop.at >= t)
  if (after <= 0) {
    const edge = after === 0 ? stops[0]! : stops[stops.length - 1]!
    return { tone: edge.tone, opacity: edge.opacity }
  }
  const from = stops[after - 1]!
  const to = stops[after]!
  const share = (t - from.at) / (to.at - from.at)
  return {
    tone: to.tone,
    opacity: from.opacity + (to.opacity - from.opacity) * share,
  }
}

function paintAt(
  paint: Paint,
  x: number,
  y: number
): { tone: Tone; opacity: number } {
  if (paint.type === "solid") return paint
  if (paint.type === "linear") {
    const dx = paint.x2 - paint.x1
    const dy = paint.y2 - paint.y1
    const at = ((x - paint.x1) * dx + (y - paint.y1) * dy) / (dx * dx + dy * dy)
    return alongStops(paint.stops, at)
  }
  const dx = x - paint.cx
  const dy = y - paint.cy
  return alongStops(paint.stops, Math.sqrt(dx * dx + dy * dy) / paint.r)
}

function poolAt(pool: Pool, x: number, y: number) {
  const angle = radians(pool.rotate)
  const dx = x - pool.cx
  const dy = y - pool.cy
  const u = (dx * cos(angle) + dy * sin(angle)) / pool.rx
  const v = (-dx * sin(angle) + dy * cos(angle)) / pool.ry
  const t = Math.sqrt(u * u + v * v)
  return t >= 1 ? 0 : poolAlpha(t, pool.core) * pool.opacity
}

function lightAt(layers: Layer[], x: number, y: number) {
  let alpha = 0
  for (const layer of layers) {
    let over = 0
    if (layer.kind === "pool") over = poolAt(layer, x, y)
    if (
      layer.kind === "shapes" &&
      layer.shapes.some((shape) => contains(shape, x, y))
    ) {
      over = paintAt(layer.paint, x, y).opacity
    }
    alpha = alpha + over * (1 - alpha)
  }
  return alpha
}

export function colorAt(scene: Scene, x: number, y: number): Rgb {
  const tone = (name: Tone) => [...parseHex(scene.palette[name])] as Rgb
  const draw = (under: Rgb, layer: Layer): Rgb => {
    switch (layer.kind) {
      case "fill":
        return tone(layer.tone)
      case "pool":
        return blend(under, tone(layer.tone), poolAt(layer, x, y))
      case "shapes": {
        let color = under
        for (const shape of layer.shapes) {
          if (contains(shape, x, y)) {
            const paint = paintAt(layer.paint, x, y)
            color = blend(color, tone(paint.tone), paint.opacity)
          }
        }
        return color
      }
      case "stipple":
        return blend(under, tone(layer.tone), lightAt(layer.layers, x, y))
      case "blur":
      case "soften":
        return layer.layers.reduce(draw, under)
      case "clip":
        return contains(layer.shape, x, y)
          ? layer.layers.reduce(draw, under)
          : under
      case "grain":
        return under
      // The title is what is being read, not what it is read against, and
      // the logo is the brand's own.
      case "text":
      case "logo":
        return under
    }
  }
  return scene.layers.reduce(draw, [0, 0, 0] as Rgb)
}

const toHex = (color: Rgb) =>
  `#${color
    .map((channel) =>
      Math.round(clamp(channel, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`

// The areas the art keeps clear of, in the scene's own units.
export function keptBoxes(scene: Scene) {
  const scale = scene.size.w / scene.output.w
  return scene.areas
    .filter((area) => area.clear)
    // A hair inside, so a box that only meets an area's edge isn't counted
    // as on it after the round trip through pixels.
    .map((area) => ({ x: area.x * scale + 1e-6, y: area.y * scale + 1e-6, w: area.width * scale - 2e-6, h: area.height * scale - 2e-6 }))
}

// The worst contrast the content's colour gets anywhere in an area the art
// goes around: content there sits straight on the art.
export function worstTitleContrast(scene: Scene, steps = 14) {
  const scale = scene.size.w / scene.output.w
  let worst = Infinity
  for (const area of scene.areas) {
    if (area.art !== "around") continue
    const [x, y, w, h] = [area.x, area.y, area.width, area.height].map((value) => value * scale) as [number, number, number, number]
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const under = toHex(colorAt(scene, x + (w * i) / steps, y + (h * j) / steps))
        worst = Math.min(worst, contrast(scene.ink, under))
      }
    }
  }
  return worst
}

// How much of the art differs from its own ground, sampled over the canvas.
// `clear` names other colours that stand for open ground, as the pale veins
// of a dark marbled sheet do.
export function coverage(scene: Scene, steps = 37, clear: string[] = []) {
  const ground = scene.palette.ground
  let moved = 0
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      // Offset along the golden ratio: a regular grid of samples can fall
      // into the gaps of a regular grid of cells.
      const here = toHex(
        colorAt(
          scene,
          (scene.size.w * (i + ((j * 0.618034) % 1))) / steps,
          (scene.size.h * (j + ((i * 0.381966) % 1))) / steps
        )
      )
      if ([ground, ...clear].every((open) => contrast(here, open) > 1.15)) moved++
    }
  }
  return moved / (steps * steps)
}

export type Verdict = {
  ok: boolean
  // The worst contrast content gets in an area the art goes around; Infinity
  // with none.
  contrast: number
  // The share of the canvas the art covers.
  coverage: number
  // What is wrong, said as a fix would be looked for.
  problems: string[]
}

// Styles drawn in hairlines, which cover little of a canvas by nature: they
// are never held to how much of it they cover. A style made from the
// grammar with a hairline fill joins them as it is made (see compose.ts).
export const HAIRLINE = new Set<string>(["linework", "dither", "typewriter", "currents"])

// Whether a cover is fit to show: every area's content reads at 4.5:1, the art
// is neither blank nor, where content sits on it, a wall, and its subject
// stays out of every area. Art with no content on it, such as a bare
// banner, may fill its canvas.
export function judge(scene: Scene, steps = 8): Verdict {
  const problems: string[] = []
  const worst = worstTitleContrast(scene, steps)
  if (worst < 4.5) problems.push(`content reads at ${worst.toFixed(2)}:1 in an area, under 4.5:1`)
  const covered = coverage(scene, 23)
  if (covered <= 0.04 && !HAIRLINE.has(scene.style)) problems.push(`the art covers ${(covered * 100).toFixed(1)}% of the canvas: almost blank`)
  if (covered >= 0.98 && scene.areas.length) problems.push("the art covers the whole canvas, leaving no ground")
  const kept = keptBoxes(scene)
  if (scene.subject && kept.length && boxesTouch(scene.subject, kept)) problems.push("the subject runs into an area")
  const logo = logoContrast(scene)
  if (logo < 3) problems.push(`the logo shows at ${logo.toFixed(2)}:1 on what is under it, under 3:1`)
  return { ok: problems.length === 0, contrast: worst, coverage: covered, problems }
}

// How well an SVG logo shows: the best contrast any colour it is drawn in
// gets against the art beneath its middle, as a graphic needs 3:1 to be
// seen. Infinity with no logo, or one whose colours can't be read, such as a
// PNG's.
export function logoContrast(scene: Scene) {
  const layer = scene.layers.find((item) => item.kind === "logo")
  if (!layer || layer.kind !== "logo") return Infinity
  const data = layer.href.match(/^data:image\/svg\+xml;base64,(.*)$/)?.[1]
  if (!data) return Infinity
  const svg = atob(data)
  const drawn = logoColours(svg)
  if (!drawn.length) return Infinity
  const under = toHex(colorAt(scene, layer.x + layer.w / 2, layer.y + layer.h / 2))
  return Math.max(...drawn.map((colour) => contrast(colour, under)))
}
