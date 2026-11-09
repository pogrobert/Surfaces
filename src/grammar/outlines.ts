import { atan2, cos, PI, radians, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Box, Shape } from "../core/scene.ts"
import { boxesTouch, inflate } from "../layouts/geometry.ts"
import type { Context, DrawnFigure, FigurePart, FigureStage } from "./parts.ts"
import { seated } from "./seated.ts"

// Figures cut as one outline, or as a stack of them: a form a fill is seen
// through, such as a disc of woven cloth, and the layers of a paper cut.
// Every outline is drawn in a unit square and set into the figure's square,
// turned as its shape allows, its edge a little uneven, as a knife leaves it.

type Points = number[]

const STEPS = 144

// A closed curve from a function of the turn round it, 0 to 1.
const curve = (at: (t: number) => [number, number], steps = STEPS): Points => {
  const points: Points = []
  for (let i = 0; i < steps; i++) points.push(...at(i / steps))
  return points
}

const circle = (cx: number, cy: number, r: number, steps = STEPS) => curve((t) => [cx + cos(t * TAU) * r, cy + sin(t * TAU) * r], steps)

// An arc from one angle to the next, its ends included.
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): Points {
  const points: Points = []
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    points.push(cx + cos(a) * r, cy + sin(a) * r)
  }
  return points
}

// A doorway: a round top over straight sides, standing on the square's foot.
function archOf(left: number, right: number, top: number, bottom = 1): Points {
  const r = (right - left) / 2
  const cx = left + r
  return [left, bottom, ...arc(cx, top + r, r, PI, TAU, 48), right, bottom]
}

// The outlines of one form, in a unit square: the primitives a designer's
// shape kit is made of, drawn true, with nothing in them that reads as a
// sign of any one people or faith.
const FORMS: Record<string, () => Points> = {
  orb: () => circle(0.5, 0.5, 0.5),
  // A capsule a little under twice as long as it is wide.
  pill: () => [...arc(0.7, 0.5, 0.3, -PI / 2, PI / 2, 48), ...arc(0.3, 0.5, 0.3, PI / 2, (3 * PI) / 2, 48)],
  // A square with its corners worn round, as a superellipse is.
  slab: () =>
    curve((t) => {
      const c = cos(t * TAU)
      const s = sin(t * TAU)
      return [0.5 + Math.sign(c) * Math.sqrt(Math.abs(c)) * 0.46, 0.5 + Math.sign(s) * Math.sqrt(Math.abs(s)) * 0.46]
    }),
  arch: () => archOf(0.15, 0.85, 0),
  // Half a disc standing on its flat side.
  dome: () => arc(0.5, 0.75, 0.5, PI, TAU, 96),
  // A quarter of a disc, its corner at the square's.
  quarter: () => [0, 1, ...arc(0, 1, 1, -PI / 2, 0, 72)],
}

// How a form may turn: a pill lies, stands or leans; a quarter faces any of
// its four ways; the rest stand as they are drawn.
const TURNS: Record<string, readonly number[]> = {
  pill: [0, PI / 2, PI / 4, -PI / 4],
  quarter: [0, PI / 2, PI, (3 * PI) / 2],
}

// A knife's edge: each point moved in or out along its way from the middle by
// a few slow waves, a share `edge` of the side for a whole outline and less
// for a small one, so a small piece is no rougher than a large one.
function cutEdge(points: Points, rng: Rng, edge: number): Points {
  const count = points.length / 2
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i += 2) {
    cx += points[i]! / count
    cy += points[i + 1]! / count
  }
  let reach = 0
  for (let i = 0; i < points.length; i += 2) reach += Math.sqrt((points[i]! - cx) * (points[i]! - cx) + (points[i + 1]! - cy) * (points[i + 1]! - cy)) / count
  const size = Math.min(reach / 0.5, 1)
  const waves = [3, 5, 8].map((k) => ({ k, amp: edge * size * rng.between([0.4, 1]), phase: rng.next() * TAU }))
  const out: Points = []
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!
    const y = points[i + 1]!
    const a = atan2(y - cy, x - cx)
    let push = 0
    for (const { k, amp, phase } of waves) push += amp * sin(k * a + phase)
    out.push(x + cos(a) * push, y + sin(a) * push)
  }
  return out
}

// Unit points set into the square at x, y of `side`, turned `angle` about its
// middle.
function placeIn(points: Points, x: number, y: number, side: number, angle: number): Points {
  const c = cos(angle)
  const s = sin(angle)
  const out: Points = []
  for (let i = 0; i < points.length; i += 2) {
    const u = (points[i]! - 0.5) * side
    const v = (points[i + 1]! - 0.5) * side
    out.push(x + u * c - v * s, y + u * s + v * c)
  }
  return out
}

function boundsOf(points: Points): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, points[i]!)
    y0 = Math.min(y0, points[i + 1]!)
    x1 = Math.max(x1, points[i]!)
    y1 = Math.max(y1, points[i + 1]!)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, w: Math.max(...boxes.map((box) => box.x + box.w)) - x, h: Math.max(...boxes.map((box) => box.y + box.h)) - y }
}

// Outlines drawn a little smaller about their middle until they come no
// nearer the title than the square they were seated in may: a turned
// outline reaches past its square at the corners.
function keptClear(context: Context, outlines: Points[], away: FigureStage["away"]): Points[] {
  const { w, h, keep, titled, fill, calm } = context
  if (!titled || fill || calm.length) return outlines
  const margin = Math.min(w, h) * 0.06
  const avoid = inflate(keep, margin / 2)
  let drawn = outlines
  let shrunk = false
  for (let attempt = 0; attempt < 8; attempt++) {
    const box = union(drawn.map(boundsOf))
    if (!boxesTouch(box, avoid)) break
    // Drawn in toward its far side, away from the title, so it backs off
    // the title and keeps as much of its size as the room allows.
    const cx = box.x + box.w / 2 + (away.x * box.w) / 2
    const cy = box.y + box.h / 2 + (away.y * box.h) / 2
    drawn = drawn.map((points) => points.map((v, i) => (i % 2 ? cy + (v - cy) * 0.92 : cx + (v - cx) * 0.92)))
    shrunk = true
  }
  if (!shrunk) return drawn
  // Drawn smaller, it may have been left hanging off an edge it no longer
  // needs to run off: it is slid back onto the canvas as far as it can go
  // without coming nearer the title.
  const box = union(drawn.map(boundsOf))
  const toward = (start: number, size: number, side: number) =>
    start < 0 ? Math.min(-start, side - (start + size)) : start + size > side ? -Math.min(start + size - side, start) : 0
  const dx = toward(box.x, box.w, w)
  const dy = toward(box.y, box.h, h)
  for (const share of [1, 0.75, 0.5, 0.25]) {
    const moved = { ...box, x: box.x + dx * share, y: box.y + dy * share }
    if (boxesTouch(moved, avoid)) continue
    return drawn.map((points) => points.map((v, i) => v + (i % 2 ? dy : dx) * share))
  }
  return drawn
}

// How large a figure is drawn behind a title in the middle: past the
// clearing on every side, `reach` of the way from its edge to the canvas's,
// so it shows all round the title and still leaves ground beyond.
function behind({ calm, w, h }: Context, side: number, reach: number) {
  const box = calm[0]
  if (!box) return side
  return Math.max(side, box.w + (w - box.w) * reach, box.h + (h - box.h) * reach)
}

function turnOf(shape: string, rng: Rng) {
  const turns = TURNS[shape]
  return turns ? rng.pick(turns) : 0
}

// One form, whole, drawn true: a disc, a pill, a rounded square, a doorway,
// a dome or a quarter disc. A fill is seen through it.
export const form: FigurePart = {
  name: "form",
  ranges: {
    size: [0.8, 0.94],
  },
  moods: {
    bold: { size: [0.88, 0.94] },
  },
  shapes: ["orb", "pill", "slab", "arch", "dome", "quarter"],
  // A form is seen through, not punched out of a slab: a slab cut to the
  // form's own box leaves only a rim of it.
  avoid: ["cutout"],

  draw(context: Context, stage: FigureStage, shape: string, p): DrawnFigure {
    const rng = context.rng.fork("figure")
    const seat = seated(context, stage, p.size!, rng)
    const { x, y } = seat
    // Behind a title in the middle, one solid form the size of the clearing
    // would hide under it: it is drawn larger, to show all round it.
    const side = behind(context, seat.side, 0.85)
    const outline = (FORMS[shape] ?? FORMS.orb!)()
    const [points] = keptClear(context, [placeIn(outline, x, y, side, turnOf(shape, rng))], stage.away) as [Points]
    return { shapes: [{ type: "polygon", points }], voids: [], subject: boundsOf(points) }
  },
}

// The layers of one cut, back to front, in a unit square: each a whole
// outline, so every layer lies on the one behind it as paper does.
const STACKS: Record<string, (count: number, rng: Rng) => Points[]> = {
  // Arches inside arches, all standing on one line.
  rainbow: (count) =>
    Array.from({ length: count }, (_, k) => {
      const inset = (k / count) * 0.42
      return archOf(inset, 1 - inset, inset * 1.05)
    }),
  // Rings of land round a pool, each drawn in toward one side, so they lie
  // close there and wide apart across from it.
  ripples: (count, rng) => {
    const lean = rng.next() * TAU
    const phase = rng.next() * TAU
    return Array.from({ length: count }, (_, k) => {
      const r = 0.5 * (1 - k / (count + 0.4))
      const cx = 0.5 + cos(lean) * (0.5 - r) * 0.55
      const cy = 0.5 + sin(lean) * (0.5 - r) * 0.55
      return curve((t) => {
        const a = t * TAU
        const rr = r * (1 + 0.06 * sin(3 * a + phase + k * 0.7) + 0.035 * sin(5 * a - phase))
        return [cx + cos(a) * rr, cy + sin(a) * rr]
      })
    })
  },
  // Rounded squares inside rounded squares, each drawn toward one corner, so
  // they lie close on that side and step wide apart on the other.
  frames: (count, rng) => {
    const corner = rng.int(0, 3)
    const toward = [[-1, -1], [1, -1], [1, 1], [-1, 1]][corner]!
    return Array.from({ length: count }, (_, k) => {
      const half = 0.5 * (1 - k / (count + 0.5))
      const cx = 0.5 + toward[0]! * (0.5 - half) * 0.7
      const cy = 0.5 + toward[1]! * (0.5 - half) * 0.7
      const round = half * 0.42
      const box = (x: number, y: number, w: number, h: number, r: number): Points => [
        ...arc(x + w - r, y + r, r, -PI / 2, 0, 16),
        ...arc(x + w - r, y + h - r, r, 0, PI / 2, 16),
        ...arc(x + r, y + h - r, r, PI / 2, PI, 16),
        ...arc(x + r, y + r, r, PI, (3 * PI) / 2, 16),
      ]
      return box(cx - half, cy - half, half * 2, half * 2, round)
    })
  },
  // A disc of sky, a sun low in it, and hills before it, each lower and
  // nearer, cut to the disc's edge.
  hills: (count, rng) => {
    const sky = circle(0.5, 0.5, 0.5)
    const sunAt = rng.between([0.28, 0.72])
    const sun = circle(sunAt, rng.between([0.34, 0.42]), rng.between([0.09, 0.13]))
    const many = Math.max(count - 2, 2)
    const hills = Array.from({ length: many }, (_, k): Points => {
      const level = 0.46 + ((k + 1) / (many + 1)) * 0.42
      const freq = rng.between([1.2, 2.4])
      const phase = rng.next() * TAU
      const amp = rng.between([0.04, 0.08])
      const top: Points = []
      for (let i = 0; i <= 64; i++) {
        const x = i / 64
        let px = x
        let py = level + amp * sin(freq * TAU * x + phase)
        // Kept to the disc: a point outside it is drawn onto its edge.
        const dx = px - 0.5
        const dy = py - 0.5
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > 0.5) {
          px = 0.5 + (dx / d) * 0.5
          py = 0.5 + (dy / d) * 0.5
        }
        top.push(px, py)
      }
      // Round the disc's foot from the right end back to the left.
      const from = atan2(top.at(-1)! - 0.5, top.at(-2)! - 0.5)
      let to = atan2(top[1]! - 0.5, top[0]! - 0.5)
      while (to < from) to += TAU
      return [...top, ...arc(0.5, 0.5, 0.5, from, to, 48).slice(2, -2)]
    })
    return [sky, sun, ...hills]
  },
}

// A paper cut: layers of one outline stacked back to front, rainbows,
// ripples, frames or hills under a sun. A relation lays each on the last.
export const cut: FigurePart = {
  name: "cut",
  ranges: {
    size: [0.82, 0.96],
    layers: [4, 6.99],
    edge: [0.0004, 0.0012],
  },
  moods: {
    calm: { layers: [4, 4.99] },
    bold: { layers: [5, 6.99], size: [0.9, 0.96] },
  },
  shapes: ["rainbow", "ripples", "frames", "hills"],
  // Its layers are laid one on another, not seen through, printed in two
  // inks, laid as grain or washed together.
  avoid: ["inside", "cutout", "press", "plate", "block", "wash"],

  draw(context: Context, stage: FigureStage, shape: string, p): DrawnFigure {
    const rng = context.rng.fork("figure")
    const seat = seated(context, stage, p.size!, rng)
    const { x, y } = seat
    // Framed large with nothing to keep clear, a stack of solid paper would
    // fill the canvas, where a mark of tiles has its gaps: it reaches a little
    // past the short side at most.
    const framed = !context.titled && !context.fill ? Math.min(seat.side, Math.min(context.w, context.h) * 1.08) : seat.side
    const side = behind(context, framed, 0.45)
    const stack = (STACKS[shape] ?? STACKS.rainbow!)(Math.floor(p.layers!), rng)
    const angle = shape === "rainbow" ? 0 : (rng.next() * 2 - 1) * radians(12)
    const layers = keptClear(context, stack.map((outline) => placeIn(cutEdge(outline, rng, p.edge!), x, y, side, angle)), stage.away)
    const shapes: Shape[] = layers.map((points) => ({ type: "polygon", points }))
    return { shapes, voids: [], subject: union(shapes.map((shape) => boundsOf((shape as { points: Points }).points))) }
  },
}
