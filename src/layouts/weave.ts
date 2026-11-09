import { atan2, cos, sin } from "../core/math.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Mark, Shape, Tone } from "../core/scene.ts"
import { behind, boundsOf, keptClear, union } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { cloth, SETTS } from "../grammar/materials.ts"
import type { Sett } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Cloth as it is seen: a cut swatch with its threads fraying at two edges, a
// piece with a corner folded back to show its other side, a woven strap
// crossing the sheet with its selvedges, or a pile of folded cloths, each of
// its own sett. Every piece lies a little above what is under it and casts a
// soft shadow there (the lift process draws it).

export const SUBJECTS = ["swatch", "fold", "strap", "stack"] as const
export type Subject = (typeof SUBJECTS)[number]

export type WeaveParams = {
  size: number
  // Threads across the subject.
  threads: number
  thread: number
  tilt: number
}

// A box of w by h turned `angle` about its middle at x, y, as four corners.
function box(x: number, y: number, w: number, h: number, angle: number): Points {
  const c = cos(angle)
  const s = sin(angle)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([u, v]) => [x + (u! * w * c) / 2 - (v! * h * s) / 2, y + (u! * w * s) / 2 + (v! * h * c) / 2])
}

// The middle, width, height and turn of a box drawn by `box`, read back after
// it has been moved or drawn smaller.
function readBox(points: Points) {
  const x = (points[0]! + points[2]! + points[4]! + points[6]!) / 4
  const y = (points[1]! + points[3]! + points[5]! + points[7]!) / 4
  const w = Math.sqrt((points[2]! - points[0]!) * (points[2]! - points[0]!) + (points[3]! - points[1]!) * (points[3]! - points[1]!))
  const h = Math.sqrt((points[6]! - points[0]!) * (points[6]! - points[0]!) + (points[7]! - points[1]!) * (points[7]! - points[1]!))
  return { x, y, w, h, angle: atan2(points[3]! - points[1]!, points[2]! - points[0]!) }
}

// A point reflected across the line through a and b.
function reflect(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
  const fx = ax + dx * t
  const fy = ay + dy * t
  return [2 * fx - px, 2 * fy - py] as const
}

// The back of a cloth: the same threads, each a step lighter, as the reverse
// of a woven piece shows the colours less strongly.
const LIGHTER: Record<Tone, Tone> = { ground: "ground", quiet: "quiet", soft: "quiet", body: "soft", accent: "body", strong: "accent", partner: "soft", ink: "strong" }
const reverse = (sett: Sett): Sett => ({ warp: sett.weft.map((tone) => LIGHTER[tone]), weft: sett.warp.map((tone) => LIGHTER[tone]) })

export function weave(frame: Frame, subject: Subject, p: WeaveParams): Art {
  const { w, h, theme, titled, keep, rng } = frame
  const draw = rng.fork("weave")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  const pitch = side / Math.round(p.threads)
  const turn = p.tilt * 0.8
  const sett = draw.pick(SETTS)
  // Cloth filling a piece's outline, the threads squared to the piece.
  const fill = (id: string, outline: Points, angle: number, which: Sett = sett): Piece => {
    const region = boundsOf(outline)
    const threads = Math.max(region.w, region.h) / pitch
    return { id, clip: { type: "polygon", points: outline }, marks: cloth(theme, draw.fork(id), region, { threads, thread: p.thread, tilt: 0 }, { sett: which, angle, id, within: outline }) }
  }

  const pieces: Piece[] = []
  const marks: Mark[] = []
  const zone = titled ? inflate(keep, Math.min(w, h) * 0.02) : []
  const onTitle = (x: number, y: number) => zone.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)

  if (subject === "swatch") {
    const [outline] = keptClear(frame, [box(cx, cy, side * 0.8, side * 0.8, turn)], stage.away) as [Points]
    const at = readBox(outline)
    pieces.push(fill("swatch", outline, at.angle))
    // Threads loose at the top and foot, where the weft has worked out: each
    // warp thread runs on past the edge a little way, frayed.
    const c = cos(at.angle)
    const s = sin(at.angle)
    const across = Math.round(at.w / pitch)
    const fringe = new Map<Tone, Shape[]>()
    const frayed = draw.fork("fringe")
    for (const edge of [-1, 1]) {
      for (let i = 0; i < across; i++) {
        const u = -at.w / 2 + (i + 0.5) * (at.w / across)
        const length = side * frayed.between([0.02, 0.055])
        const width = pitch * p.thread * frayed.between([0.42, 0.6])
        const start = (edge * at.h) / 2
        const end = start + edge * length
        const corners = [
          [u - width / 2, start],
          [u + width / 2, start],
          [u + width / 2 + frayed.between([-0.3, 0.3]) * width, end],
          [u - width / 2 + frayed.between([-0.3, 0.3]) * width, end],
        ]
        const points = corners.flatMap(([a, b]) => [at.x + a! * c - b! * s, at.y + a! * s + b! * c])
        if (onTitle(points[4]!, points[5]!) || onTitle(points[6]!, points[7]!)) continue
        const tone = sett.warp[((i % sett.warp.length) + sett.warp.length) % sett.warp.length]!
        fringe.set(tone, [...(fringe.get(tone) ?? []), { type: "polygon", points }])
      }
    }
    for (const [tone, shapes] of fringe) marks.push({ kind: "shapes", id: `fringe-${tone}`, paint: { type: "solid", tone, opacity: 0.9 }, shapes })
  } else if (subject === "fold") {
    const [outline] = keptClear(frame, [box(cx, cy, side * 0.9, side * 0.74, turn)], stage.away) as [Points]
    const at = readBox(outline)
    // The corner nearest the light folded back along a line across it.
    const [x0, y0, x1, y1, x2, y2] = outline as [number, number, number, number, number, number]
    const a = draw.between([0.42, 0.6])
    const b = draw.between([0.42, 0.62])
    const ax = x1 + (x0 - x1) * a
    const ay = y1 + (y0 - y1) * a
    const bx = x1 + (x2 - x1) * b
    const by = y1 + (y2 - y1) * b
    const rest: Points = [outline[0]!, outline[1]!, ax, ay, bx, by, outline[4]!, outline[5]!, outline[6]!, outline[7]!]
    const [fx, fy] = reflect(x1, y1, ax, ay, bx, by)
    const flap: Points = [ax, ay, fx, fy, bx, by]
    pieces.push(fill("cloth", rest, at.angle), fill("flap", flap, at.angle, reverse(sett)))
  } else if (subject === "strap") {
    // A band of webbing across the sheet, long enough to run off it, its two
    // edges woven tighter in a darker thread.
    const angle = (draw.next() < 0.5 ? -1 : 1) * draw.between([0.3, 0.6])
    const [outline] = keptClear(frame, [box(cx, cy, side * 1.9, side * 0.44, angle)], stage.away) as [Points]
    const at = readBox(outline)
    const piece = fill("strap", outline, angle)
    const edge = at.h * 0.09
    const c = cos(angle)
    const s = sin(angle)
    const selvedges: Shape[] = [-1, 1].map((side) => {
      const v = (side * (at.h - edge)) / 2
      return { type: "polygon", points: box(at.x - s * v, at.y + c * v, at.w, edge, angle) }
    })
    pieces.push({ ...piece, marks: [...piece.marks, { kind: "shapes", id: "selvedges", paint: { type: "solid", tone: "strong", opacity: 0.92 }, shapes: selvedges }] })
  } else {
    // Folded cloths in a pile, each its own sett, the top one squarest.
    const count = draw.int(3, 4)
    const layer = (side * 0.78) / count
    const outlines = Array.from({ length: count }, (_, k) => {
      const shift = draw.between([-0.05, 0.05]) * side
      const width = side * (0.84 - k * 0.04)
      const y = cy + side * 0.39 - (k + 0.5) * layer
      return box(cx + shift, y, width, layer * 0.96, draw.between([-0.02, 0.02]))
    })
    const placed = keptClear(frame, outlines, stage.away)
    placed.forEach((outline, k) => {
      const at = readBox(outline)
      const own = k === 0 ? sett : SETTS[(SETTS.indexOf(sett) + k) % SETTS.length]!
      const piece = fill(`fold${k}`, outline, at.angle, own)
      // The folded edge in front, a little lighter where it turns.
      const lip = box(at.x, at.y + at.h * 0.4, at.w, at.h * 0.2, at.angle)
      pieces.push({ ...piece, marks: [...piece.marks, { kind: "shapes", id: `fold${k}-lip`, paint: { type: "solid", tone: theme === "dark" ? "ink" : "ground", opacity: 0.14 }, shapes: [{ type: "polygon", points: lip }] }] })
    })
  }

  const subjectBox = union(pieces.map((piece) => boundsOf((piece.clip as { points: Points }).points)))
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    pieces,
    over: [],
    subject: subjectBox,
  }
}
