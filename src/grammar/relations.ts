import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { boxesTouch } from "../layouts/geometry.ts"
import type { RelationPart } from "./parts.ts"

// How a figure and a fill meet.

export function bounds(shape: Shape): Box {
  switch (shape.type) {
    case "rect":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
    case "circle":
    case "ring":
      return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }
    case "ellipse":
      return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 }
    default: {
      const step = shape.type === "polygon" ? 2 : 3
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
      for (let i = 0; i < shape.points.length; i += step) {
        const x = shape.points[i]!
        const y = shape.points[i + 1]!
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }
  }
}

// The fill's marks that reach into `box`, renamed for the piece they go in,
// so a fill cut into four tiles is four sets of ids, not one id four times.
function within(fill: Mark[], box: Box, id: string): Mark[] {
  return fill.flatMap((mark): Mark[] => {
    if (mark.kind !== "shapes") return [{ ...mark, id: `${id}-${mark.id}` }]
    const shapes = mark.shapes.filter((shape) => boxesTouch(bounds(shape), box))
    return shapes.length ? [{ ...mark, id: `${id}-${mark.id}`, shapes }] : []
  })
}

// The fill seen only inside the figure, each shape a window onto one sheet
// of it, so its blots run on from tile to tile across the gaps.
export const inside: RelationPart = {
  name: "inside",
  ranges: {},
  join: (_, figure, fill) => ({
    marks: [],
    pieces: figure.shapes.map((shape, index) => {
      const id = `tile${index}`
      return { id, clip: shape, marks: within(fill, bounds(shape), id) }
    }),
  }),
}

// A shape drawn `k` the size about a point.
function scaled(shape: Shape, cx: number, cy: number, k: number): Shape {
  const at = (x: number, y: number) => [cx + (x - cx) * k, cy + (y - cy) * k] as const
  switch (shape.type) {
    case "polygon":
      return { ...shape, points: shape.points.map((v, i) => (i % 2 ? cy + (v - cy) * k : cx + (v - cx) * k)) }
    case "circle": {
      const [x, y] = at(shape.cx, shape.cy)
      return { ...shape, cx: x, cy: y, r: shape.r * k }
    }
    default:
      return shape
  }
}

// The figure cut out of a slab of the fill, as paper shows through a stencil.
// The slab takes the figure's box, and the figure is cut a little inside it,
// its voids with it, so a gap the tiles close round opens onto paper too.
export const cutout: RelationPart = {
  name: "cutout",
  ranges: {},
  join(_, figure, fill) {
    const { x, y, w, h } = figure.subject
    const round = w * 0.07
    const cx = x + w / 2
    const cy = y + h / 2
    return {
      marks: [],
      pieces: [
        {
          id: "slab",
          clip: { type: "rect", x, y, w, h, radii: [round, round, round, round] },
          marks: fill.map((mark) => ({ ...mark, id: `slab-${mark.id}` })),
        },
      ],
      over: [
        {
          kind: "shapes",
          id: "stencil",
          paint: { type: "solid", tone: "ground", opacity: 1 },
          shapes: [...figure.shapes, ...figure.voids].map((shape) => scaled(shape, cx, cy, 0.64)),
        },
      ],
    }
  },
}

// Tones from the back of a stack to its front, deepening as layers of paper
// in one colour do.
const LADDER: readonly Tone[] = ["quiet", "soft", "body", "accent", "strong", "ink"]

// The fill's marks in one tone, for a layer of paper that colour.
const retoned = (marks: Mark[], tone: Tone): Mark[] =>
  marks.map((mark) => (mark.kind === "shapes" && mark.paint.type === "solid" ? { ...mark, paint: { ...mark.paint, tone } } : mark))

// Layers laid one on the next, back to front, each its own sheet of the fill
// in a tone a step deeper than the one behind it, and now and then one in
// the brand's partner colour. The process lays each on the last.
export const stacked: RelationPart = {
  name: "stacked",
  ranges: {},
  // Only a cut has layers to stack.
  avoid: ["tiles", "form"],
  join(context, figure, fill) {
    const rng = context.rng.fork("stack")
    const count = figure.shapes.length
    // From a light step to a deep one, wherever the stack is short.
    const from = count > 5 ? 0 : 1
    const to = 4.6
    const partner = rng.next() < 0.55 ? rng.int(1, Math.max(1, count - 2)) : -1
    return {
      marks: [],
      pieces: figure.shapes.map((shape, index) => {
        const id = `layer${index}`
        const step = Math.round(from + ((to - from) * index) / Math.max(1, count - 1))
        const tone = index === partner ? "partner" : LADDER[Math.min(step, LADDER.length - 1)]!
        return { id, clip: shape, marks: retoned(within(fill, bounds(shape), id), tone) }
      }),
    }
  },
}

export const RELATIONS = { inside, cutout, stacked }
