import { atan2, clamp, cos, PI, sin, TAU } from "../core/math.ts"
import type { Box, Shape } from "../core/scene.ts"
import { boxesTouch, inflate } from "../layouts/geometry.ts"
import { seat } from "../shapes/subjects.ts"
import type { Context, DrawnFigure, FigurePart, FigureStage } from "./parts.ts"

// A mark built from a few rounded tiles with round bites taken out of them,
// the way a sign painter cuts a stencil. Every seed assembles its own: the
// tiles, which corners are bitten and how deep, the turn of the whole. None
// is a copy of any one mark, and no void ever holds a dot: a void with a dot
// in it is one brand's mark already.

// Flat x, y pairs round a box with rounded corners, clockwise on the screen.
// Radii run clockwise from the top left, as a rect's do.
function roundedBox(x: number, y: number, w: number, h: number, radii: readonly number[]) {
  const points: number[] = []
  const corner = (cx: number, cy: number, r: number, from: number) => {
    for (let step = 0; step <= 10; step++) {
      const a = from + (step / 10) * (PI / 2)
      points.push(cx + cos(a) * r, cy + sin(a) * r)
    }
  }
  const [tl, tr, br, bl] = radii as [number, number, number, number]
  const sharp = (px: number, py: number) => points.push(px, py)
  if (tl > 0) corner(x + tl, y + tl, tl, PI)
  else sharp(x, y)
  if (tr > 0) corner(x + w - tr, y + tr, tr, -PI / 2)
  else sharp(x + w, y)
  if (br > 0) corner(x + w - br, y + h - br, br, 0)
  else sharp(x + w, y + h)
  if (bl > 0) corner(x + bl, y + h - bl, bl, PI / 2)
  else sharp(x, y + h)
  return points
}

function signedArea(points: readonly number[]) {
  let sum = 0
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    sum += points[i * 2]! * points[j * 2 + 1]! - points[j * 2]! * points[i * 2 + 1]!
  }
  return sum / 2
}

// The shares along a segment where it crosses a circle, in order.
function crossings(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) {
  const dx = bx - ax
  const dy = by - ay
  const fx = ax - cx
  const fy = ay - cy
  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  const d = b * b - 4 * a * c
  if (a === 0 || d <= 0) return []
  const root = Math.sqrt(d)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((t) => t > 0 && t < 1)
}

// A polygon with a disk taken out of it, where the disk reaches across its
// edge: the part inside the disk is replaced by the disk's own arc. A disk
// wholly inside would make a hole, which a polygon can't hold; the parts
// below never ask for one. Empty when the disk swallows it.
export function bite(points: readonly number[], cx: number, cy: number, r: number): number[] {
  const n = points.length / 2
  const inside = (i: number) => {
    const dx = points[i * 2]! - cx
    const dy = points[i * 2 + 1]! - cy
    return dx * dx + dy * dy < r * r
  }
  let start = -1
  for (let i = 0; i < n; i++) {
    if (!inside(i)) {
      start = i
      break
    }
  }
  if (start < 0) return []
  // Round the disk the other way from the polygon, so the arc keeps the
  // polygon's inside on the same side as its edges do.
  const way = signedArea(points) > 0 ? -1 : 1
  const out: number[] = []
  let entry = 0
  const arc = (from: number, to: number) => {
    let turn = to - from
    if (way < 0) while (turn > 0) turn -= TAU
    else while (turn < 0) turn += TAU
    const steps = Math.max(2, Math.ceil(Math.abs(turn) / (PI / 24)))
    for (let step = 1; step < steps; step++) {
      const a = from + (turn * step) / steps
      out.push(cx + cos(a) * r, cy + sin(a) * r)
    }
  }
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    const j = (i + 1) % n
    const ax = points[i * 2]!
    const ay = points[i * 2 + 1]!
    const bx = points[j * 2]!
    const by = points[j * 2 + 1]!
    if (!inside(i)) out.push(ax, ay)
    for (const t of crossings(ax, ay, bx, by, cx, cy, r)) {
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      const a = atan2(y - cy, x - cx)
      // Just past the crossing, inside the disk: the edge stops here. Outside
      // it: the arc runs from where the edge stopped and joins it again.
      const s = Math.min(1, t + 1e-6)
      const px = ax + (bx - ax) * s - cx
      const py = ay + (by - ay) * s - cy
      if (px * px + py * py < r * r) {
        out.push(x, y)
        entry = a
      } else {
        arc(entry, a)
        out.push(x, y)
      }
    }
  }
  return out
}

type Circle = { cx: number; cy: number; r: number }
type Unit = { points: number[] }

// Tiles in a unit square, before they are turned and set on the canvas.
function assemble(shape: string, p: Record<string, number>): { units: Unit[]; voids: Circle[] } {
  const g = p.gap!
  const a = (1 - g) / 2
  const r = p.round! * a
  const b = p.bite!
  const tile = (x: number, y: number, w: number, h: number, radii = [r, r, r, r]) =>
    roundedBox(x, y, w, h, radii)
  const quarters = () => [tile(0, 0, a, a), tile(1 - a, 0, a, a), tile(1 - a, 1 - a, a, a), tile(0, 1 - a, a, a)]
  const cut = (tiles: number[][], disks: [number, number, number][]) =>
    tiles.map((points) => ({ points: disks.reduce((kept, [x, y, rr]) => bite(kept, x, y, rr), points) }))
  switch (shape) {
    case "grid": {
      // Bitten round a shared void in the middle, never with a dot in it.
      const void_ = b + g / 2
      return { units: cut(quarters(), [[0.5, 0.5, void_]]), voids: [{ cx: 0.5, cy: 0.5, r: void_ }] }
    }
    case "star": {
      // Bitten at the four outer corners, so the tiles point outward.
      const corners: [number, number, number][] = [
        [0, 0, b * 1.3],
        [1, 0, b * 1.3],
        [1, 1, b * 1.3],
        [0, 1, b * 1.3],
      ]
      return { units: cut(quarters(), corners), voids: [] }
    }
    case "pinwheel": {
      // Each tile bitten at the corner a quarter turn on from the last.
      const corners: [number, number][] = [
        [a, 0],
        [1, a],
        [1 - a, 1],
        [0, 1 - a],
      ]
      const units = quarters().map((points, index) => {
        const [x, y] = corners[index]!
        return { points: bite(points, x, y, b * 1.1) }
      })
      return { units, voids: [] }
    }
    case "pair": {
      // Two tall tiles facing over a round void.
      const void_ = b * 1.15
      return { units: cut([tile(0, 0, a, 1), tile(1 - a, 0, a, 1)], [[0.5, 0.5, void_]]), voids: [{ cx: 0.5, cy: 0.5, r: void_ }] }
    }
    default: {
      // An arch: a round top over a round doorway.
      return { units: cut([tile(0, 0, 1, 1, [0.5, 0.5, r, r])], [[0.5, 1, b * 1.2]]), voids: [] }
    }
  }
}

export const tiles: FigurePart = {
  name: "tiles",
  ranges: {
    size: [0.82, 0.96],
    gap: [0.035, 0.06],
    round: [0.14, 0.32],
    bite: [0.2, 0.28],
  },
  moods: {
    calm: { round: [0.24, 0.32], gap: [0.045, 0.06] },
    bold: { size: [0.9, 0.96], round: [0.14, 0.22] },
  },
  shapes: ["grid", "star", "pinwheel", "pair", "arch"],

  draw(context: Context, stage: FigureStage, shape: string, p): DrawnFigure {
    const { w, h, keep } = context
    const rng = context.rng.fork("figure")
    const margin = Math.min(w, h) * 0.06
    // Behind a large title in the middle, the mark is drawn large, so its
    // tiles frame the title round the clearing instead of hiding under it.
    const start = context.fill
      ? Math.min(w, h) * 0.66
      : context.calm.length
        ? Math.min(w, h) * 0.88
      : Math.min(Math.min(stage.area.w, stage.area.h) * p.size!, Math.min(w, h) * 0.78)
    // Seated as a round subject would be, kept on the canvas by `bleed` of
    // its side or more, and, shrinking if it must, off every area.
    const fit = (bleed: number, from: number) => {
      let side = from
      let x = w / 2
      let y = h / 2
      for (let attempt = 0; attempt < 12; attempt++) {
        if (!context.fill) {
          const at = seat({ area: stage.area, safe: keep, w, h, away: stage.away }, side / 2)
          const edge = side / 2 + margin - side * bleed
          x = clamp(at.x, edge, w - edge)
          y = clamp(at.y, edge, h - edge)
        }
        const box = { x: x - side / 2, y: y - side / 2, w: side, h: side }
        if (context.fill || !context.titled || !boxesTouch(box, inflate(keep, margin / 2))) break
        side *= 0.9
      }
      return { x, y, side }
    }
    // Whole on the canvas when there is room; where a title leaves only thin
    // bands, large and running off the edge rather than small.
    // That large mark starts from the canvas, not from the thin band, and the
    // edge may take up to 40% of it.
    let placed = fit(0, start)
    if (placed.side < Math.min(w, h) * 0.4) placed = fit(0.4, Math.min(w, h) * 0.62)
    const { x, y, side } = placed
    const { units, voids } = assemble(shape, p)
    // A quarter turn or a mirror, so one assembly faces several ways.
    const turns = shape === "grid" || shape === "star" ? 0 : rng.int(0, 4)
    const mirror = shape === "pinwheel" && rng.next() < 0.5
    const left = x - side / 2
    const top = y - side / 2
    const place = (u: number, v: number): [number, number] => {
      let pu = mirror ? 1 - u : u
      let pv = v
      for (let t = 0; t < turns; t++) [pu, pv] = [1 - pv, pu]
      return [left + pu * side, top + pv * side]
    }
    const shapes: Shape[] = units.flatMap((unit): Shape[] => {
      if (unit.points.length < 6) return []
      const points: number[] = []
      for (let i = 0; i < unit.points.length; i += 2) points.push(...place(unit.points[i]!, unit.points[i + 1]!))
      return [{ type: "polygon", points }]
    })
    const subject: Box = { x: left, y: top, w: side, h: side }
    return {
      shapes,
      voids: voids.map((circle): Shape => {
        const [cx, cy] = place(circle.cx, circle.cy)
        return { type: "circle", cx, cy, r: circle.r * side }
      }),
      subject,
    }
  },
}

export const FIGURES = { tiles }
