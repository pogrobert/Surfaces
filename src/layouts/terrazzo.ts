import { cos, PI, sin } from "../core/math.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Mark, Shape, Tone } from "../core/scene.ts"
import { arc, behind, boundsOf, keptClear, union } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { chipsIn } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { clearing } from "./stage.ts"

// Terrazzo as it is made into things: a cut tile with one corner chipped and
// its edge bevelled, a slab seen with its thickness, two blocks stepped one on
// the other, or a patch of floor laid in panels between thin metal strips.
// Every piece is one stone, its chips the same size throughout, and lies a
// little above the sheet, casting a soft shadow (the lift process draws it).

export const SUBJECTS = ["tile", "slab", "steps", "floor"] as const
export type Subject = (typeof SUBJECTS)[number]

export type TerrazzoParams = {
  size: number
  chips: number
  largest: number
  specks: number
  tilt: number
}

// A box with round corners, at x, y from its top left, turned `angle` about
// its middle, as flat points clockwise.
function rounded(x: number, y: number, w: number, h: number, r: number, angle = 0): Points {
  const points = [
    ...arc(x + w - r, y + r, r, -PI / 2, 0, 8),
    ...arc(x + w - r, y + h - r, r, 0, PI / 2, 8),
    ...arc(x + r, y + h - r, r, PI / 2, PI, 8),
    ...arc(x + r, y + r, r, PI, (3 * PI) / 2, 8),
  ]
  if (!angle) return points
  const cx = x + w / 2
  const cy = y + h / 2
  const c = cos(angle)
  const s = sin(angle)
  return points.map((v, i) => (i % 2 ? cy + (points[i - 1]! - cx) * s + (v - cy) * c : cx + (v - cx) * c - (points[i + 1]! - cy) * s))
}

const solid = (id: string, tone: Tone, shapes: Shape[], opacity: number): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity }, shapes })
const polygon = (points: Points): Shape => ({ type: "polygon", points })

// Points added along every edge longer than `step`, so an outline can be cut
// in one place without the cut running along a whole side.
function densify(points: Points, step: number): Points {
  const out: Points = []
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const ax = points[i * 2]!
    const ay = points[i * 2 + 1]!
    const bx = points[((i + 1) % n) * 2]!
    const by = points[((i + 1) % n) * 2 + 1]!
    const parts = Math.max(1, Math.ceil(Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) / step))
    for (let k = 0; k < parts; k++) out.push(ax + ((bx - ax) * k) / parts, ay + ((by - ay) * k) / parts)
  }
  return out
}

export function terrazzo(frame: Frame, subject: Subject, p: TerrazzoParams): Art {
  const { w, h, theme, rng } = frame
  const draw = rng.fork("terrazzo")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  const stone = { chips: p.chips, largest: p.largest, specks: p.specks }
  // What lies in shadow on paper, and what catches light: the sheet's own
  // dark and light, whichever way round the theme has them.
  const dark: Tone = theme === "dark" ? "ground" : "ink"
  const light: Tone = theme === "dark" ? "ink" : "ground"
  const piece = (id: string, outline: Points, extra: Mark[] = []): Piece => ({
    id,
    clip: polygon(outline),
    marks: [...chipsIn(draw.fork(id), boundsOf(outline), stone, { scale: side, id }), ...extra],
  })

  let pieces: Piece[]
  if (subject === "tile") {
    // A square tile, a little turned, one corner broken off.
    const size = side * 0.76
    const turn = p.tilt
    const drawn = rounded(cx - size / 2, cy - size / 2, size, size, size * 0.035, turn)
    const [placed] = keptClear(frame, [drawn], stage.away) as [Points]
    // Where keptClear left it, and how large: the bevel follows.
    const box = boundsOf(placed)
    const shrunk = (size * box.w) / boundsOf(drawn).w
    const mx = box.x + box.w / 2
    const my = box.y + box.h / 2
    // One corner broken off: the points near it dropped, and the break drawn
    // as two facets meeting a little in from where the corner was.
    const corner = draw.int(0, 3)
    // Points along the straight edges too, so the break takes only the corner.
    const outline = densify(placed, shrunk / 30)
    const n = outline.length / 2
    // The point nearest the chosen corner of the tile's square.
    const c = cos(turn)
    const sn = sin(turn)
    const [cu, cv] = [[1, -1], [1, 1], [-1, 1], [-1, -1]][corner]!
    const tx = mx + ((cu! * c - cv! * sn) * shrunk) / 2
    const ty = my + ((cu! * sn + cv! * c) * shrunk) / 2
    let at = 0
    for (let i = 0, best = Infinity; i < n; i++) {
      const d = (outline[i * 2]! - tx) * (outline[i * 2]! - tx) + (outline[i * 2 + 1]! - ty) * (outline[i * 2 + 1]! - ty)
      if (d < best) {
        best = d
        at = i * 2
      }
    }
    const reach = shrunk * draw.between([0.14, 0.2])
    const near = (i: number) => {
      const dx = outline[i]! - outline[at]!
      const dy = outline[i + 1]! - outline[at + 1]!
      return Math.sqrt(dx * dx + dy * dy) <= reach
    }
    const kept: number[] = []
    for (let i = 0; i < outline.length; i += 2) {
      if (!near(i)) {
        kept.push(outline[i]!, outline[i + 1]!)
        continue
      }
      if (i !== at) continue
      // The inner point of the break, toward the middle and a little to one
      // side, so the two facets are uneven.
      const inward = draw.between([0.32, 0.5]) * reach
      const toward = Math.sqrt((mx - outline[i]!) * (mx - outline[i]!) + (my - outline[i + 1]!) * (my - outline[i + 1]!))
      const ux = (mx - outline[i]!) / toward
      const uy = (my - outline[i + 1]!) / toward
      const aside = draw.between([-0.3, 0.3]) * reach
      kept.push(outline[i]! + ux * (inward + reach * 0.35) - uy * aside, outline[i + 1]! + uy * (inward + reach * 0.35) + ux * aside)
    }
    // A bevel: light along two edges, shade along the other two, turned
    // with the tile about its middle.
    const bevel = shrunk * 0.03
    const x0 = mx - shrunk / 2
    const y0 = my - shrunk / 2
    const band = (x: number, y: number, bw: number, bh: number) => {
      const points = rounded(x, y, bw, bh, 0)
      const c = cos(turn)
      const s = sin(turn)
      return points.map((v, i) => (i % 2 ? my + (points[i - 1]! - mx) * s + (v - my) * c : mx + (v - mx) * c - (points[i + 1]! - my) * s))
    }
    const top = band(x0, y0, shrunk, bevel * 2)
    const left = band(x0, y0, bevel * 2, shrunk)
    const foot = band(x0, y0 + shrunk - bevel * 2, shrunk, bevel * 2)
    const right = band(x0 + shrunk - bevel * 2, y0, bevel * 2, shrunk)
    pieces = [piece("tile", kept, [solid("tile-lit", light, [polygon(top), polygon(left)], theme === "dark" ? 0.16 : 0.32), solid("tile-shade", dark, [polygon(foot), polygon(right)], 0.16)])]
  } else if (subject === "slab" || subject === "steps") {
    // A block seen from a little above: its top, and below it the front
    // face, in shade, with a thin light line where the two meet.
    const block = (id: string, x: number, y: number, width: number, depth: number, thick: number): { outline: Points; extra: Mark[] } => {
      const outline = rounded(x, y, width, depth + thick, width * 0.012)
      return {
        outline,
        extra: [
          solid(`${id}-front`, dark, [polygon(rounded(x, y + depth, width, thick, 0))], theme === "dark" ? 0.38 : 0.2),
          solid(`${id}-edge`, light, [polygon(rounded(x, y + depth - thick * 0.06, width, thick * 0.12, 0))], 0.4),
        ],
      }
    }
    const blocks =
      subject === "slab"
        ? [block("slab", cx - side * 0.46, cy - side * 0.24, side * 0.92, side * 0.38, side * 0.1)]
        : [
            block("lower", cx - side * 0.46, cy - side * 0.06, side * 0.92, side * 0.28, side * 0.09),
            block("upper", cx - side * 0.3, cy - side * 0.36, side * 0.6, side * 0.24, side * 0.09),
          ]
    const outlines = keptClear(frame, blocks.map((b) => b.outline), stage.away)
    // Kept clear, a block may be drawn smaller: its faces follow its outline.
    pieces = outlines.map((outline, k) => {
      const before = boundsOf(blocks[k]!.outline)
      const after = boundsOf(outline)
      const scale = after.w / before.w
      const moved = blocks[k]!.extra.map((mark) =>
        mark.kind === "shapes"
          ? { ...mark, shapes: mark.shapes.map((shape) => (shape.type === "polygon" ? polygon(shape.points.map((v, i) => (i % 2 ? after.y + (v - before.y) * scale : after.x + (v - before.x) * scale))) : shape)) }
          : mark
      )
      return piece(subject === "slab" ? "slab" : k === 0 ? "lower" : "upper", outline, moved)
    })
  } else {
    // A patch of floor in panels, two by two or three by two, laid between
    // thin strips of metal.
    const across = draw.int(2, 3)
    const down = 2
    const width = side * 0.94
    const height = side * 0.74
    const [outline] = keptClear(frame, [rounded(cx - width / 2, cy - height / 2, width, height, side * 0.01)], stage.away) as [Points]
    const box = boundsOf(outline)
    const strip = side * 0.008
    const strips: Shape[] = []
    for (let i = 1; i < across; i++) strips.push(polygon(rounded(box.x + (box.w * i) / across - strip / 2, box.y, strip, box.h, 0)))
    for (let j = 1; j < down; j++) strips.push(polygon(rounded(box.x, box.y + (box.h * j) / down - strip / 2, box.w, strip, 0)))
    // Every other panel a shade deeper, as a laid floor alternates.
    const deeper: Shape[] = []
    for (let i = 0; i < across; i++) for (let j = 0; j < down; j++) if ((i + j) % 2) deeper.push(polygon(rounded(box.x + (box.w * i) / across, box.y + (box.h * j) / down, box.w / across, box.h / down, 0)))
    pieces = [piece("floor", outline, [solid("floor-deeper", "body", deeper, 0.16), solid("floor-strips", "strong", strips, 0.85)])]
  }

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces,
    over: [],
    subject: union(pieces.map((each) => boundsOf((each.clip as { points: Points }).points))),
  }
}
