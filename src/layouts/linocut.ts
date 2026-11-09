import { clamp, cos, PI, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Mark, Shape } from "../core/scene.ts"
import { arc, behind, boundsOf, insideOf, keptClear } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { CAP } from "../grammar/keys.ts"
import { stroke } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { clearing } from "./stage.ts"
import { initialOf } from "./typewriter.ts"

// A relief print: a block of lino inked and pressed, everything cut from it
// printing as paper. Each subject is carved the way a printmaker carves it,
// the gouge following the form: a landscape of hills under a sun in a ringed
// sky, a sprig of leaves with their veins cut, a sea of waves cut along their
// crests, or a printer's mark, the brand's initial left standing in a field
// cut away inside a border. The block process prints it.

export const SUBJECTS = ["landscape", "sprig", "waves", "mark"] as const
export type Subject = (typeof SUBJECTS)[number]

export type LinocutParams = {
  size: number
  // The gap between cuts, as a share of the block.
  spacing: number
  // A cut's width, as a share of that gap.
  cut: number
}

// A box with round corners, from its top left, as flat points clockwise.
function rounded(x: number, y: number, w: number, h: number, r: number): Points {
  return [
    ...arc(x + w - r, y + r, r, -PI / 2, 0, 6),
    ...arc(x + w - r, y + h - r, r, 0, PI / 2, 6),
    ...arc(x + r, y + h - r, r, PI / 2, PI, 6),
    ...arc(x + r, y + r, r, PI, (3 * PI) / 2, 6),
  ]
}

const ink = (id: string, shapes: Shape[]): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone: "ink", opacity: 1 }, shapes })
const paper = (id: string, shapes: Shape[]): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone: "ground", opacity: 1 }, shapes })

// A line along a path broken into strokes of the gouge, a few gaps long each,
// with breaks between, as a hand cuts a long line in goes.
function gouged(path: number[], width: number, rng: Rng, breaks = 0.18): Shape[] {
  const out: Shape[] = []
  const count = path.length / 2
  let i = 0
  while (i < count - 1) {
    const length = Math.max(3, Math.round(rng.between([5, 16])))
    const piece = path.slice(i * 2, Math.min(i + length, count) * 2)
    if (piece.length >= 4) out.push(stroke(piece, width * rng.between([0.8, 1.12])))
    i += length + (rng.next() < breaks ? Math.round(rng.between([1, 3])) : 0)
  }
  return out
}

export function linocut(frame: Frame & { seed: string }, subject: Subject, p: LinocutParams): Art {
  const { w, h, rng } = frame
  const draw = rng.fork("linocut")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  // Each subject is drawn in its block's own units, 1 across, and set where
  // the block lands once kept clear of the title.
  const aspect = subject === "sprig" ? 1.25 : subject === "mark" ? 1 : 0.72
  const bw = side * (aspect > 1 ? 0.8 : 1) * 0.92
  const bh = bw * aspect
  const [outline] = keptClear(frame, [rounded(seat.x - bw / 2, seat.y - bh / 2, bw, bh, bw * 0.02)], stage.away) as [Points]
  const block = boundsOf(outline)
  const k = block.w
  const at = (u: number, v: number): [number, number] => [block.x + u * k, block.y + v * k]
  const path = (points: [number, number][]) => points.flatMap(([u, v]) => at(u, v))
  const gap = p.spacing
  const width = gap * p.cut * k
  const cuts: Shape[] = []
  const solid: Shape[] = []
  const tall = block.h / k

  // A thin line cut round the block just inside its edge, as most prints keep.
  const border = () => {
    const inset = 0.035
    const edge: [number, number][] = []
    const steps = 60
    const corners: [number, number][] = [[inset, inset], [1 - inset, inset], [1 - inset, tall - inset], [inset, tall - inset], [inset, inset]]
    for (let c = 0; c < 4; c++) {
      const [u0, v0] = corners[c]!
      const [u1, v1] = corners[c + 1]!
      for (let s = 0; s <= steps / 4; s++) edge.push([u0 + ((u1 - u0) * s) / (steps / 4), v0 + ((v1 - v0) * s) / (steps / 4)])
    }
    cuts.push(...gouged(path(edge), width * 0.9, draw.fork("border"), 0.04))
  }

  if (subject === "landscape") {
    solid.push({ type: "polygon", points: outline })
    border()
    const horizon = tall * draw.between([0.5, 0.6])
    const sun = { u: draw.between([0.24, 0.76]), v: horizon * draw.between([0.42, 0.62]), r: draw.between([0.08, 0.11]) }
    // The sky in level cuts, closer together up high, stopping short of the
    // sun, round which two rings are cut.
    const sky = draw.fork("sky")
    for (let v = 0.07; v < horizon - gap; v += gap * (0.8 + (v / horizon) * 0.7)) {
      let run: [number, number][] = []
      for (let u = 0.06; u <= 0.94; u += 0.01) {
        const d = Math.sqrt((u - sun.u) * (u - sun.u) + (v - sun.v) * (v - sun.v))
        if (d < sun.r * 1.7) {
          if (run.length > 2) cuts.push(...gouged(path(run), width, sky))
          run = []
          continue
        }
        run.push([u, v + sin(u * 9 + v * 20) * gap * 0.08])
      }
      if (run.length > 2) cuts.push(...gouged(path(run), width, sky))
    }
    for (const ring of [1.25, 1.5]) {
      const r = sun.r * ring
      const points: [number, number][] = []
      for (let a = 0; a <= TAU + 0.01; a += 0.08) points.push([sun.u + cos(a) * r, sun.v + sin(a) * r])
      cuts.push(...gouged(path(points), width * 0.85, sky, 0.1))
    }
    // Hills, each in front of the last: a deep cut along its ridge, and its
    // slope cut in lines that follow the ridge down.
    const hills = draw.int(2, 3)
    const ground = draw.fork("hills")
    for (let n = 0; n < hills; n++) {
      const base = horizon + ((tall - horizon) * n) / (hills + 0.4)
      const amp = ground.between([0.03, 0.07])
      const freq = ground.between([4, 8])
      const phase = ground.next() * TAU
      const ridge = (u: number) => base + amp * sin(freq * u + phase) - amp
      const line: [number, number][] = []
      for (let u = 0.04; u <= 0.96; u += 0.01) line.push([u, ridge(u)])
      cuts.push(...gouged(path(line), width * 1.7, ground, 0.03))
      const next = n + 1 < hills ? horizon + ((tall - horizon) * (n + 1)) / (hills + 0.4) - 0.05 : tall - 0.05
      for (let d = gap * 1.2; ridge(0.5) + d < next; d += gap * 1.15) {
        const slope: [number, number][] = []
        for (let u = 0.06; u <= 0.94; u += 0.01) if (ground.next() > 0.06) slope.push([u, ridge(u) + d])
        cuts.push(...gouged(path(slope), width * clamp(1 - d * 2, 0.4, 1), ground, 0.35))
      }
    }
  } else if (subject === "sprig") {
    // A white-line print: the block left inked, and a stem curving up it with
    // leaves a little out of step drawn by cutting their outlines, midribs and
    // veins, so the sprig is the same ink as the block round it.
    solid.push({ type: "polygon", points: outline })
    border()
    const sway = draw.between([-0.12, 0.12])
    const stemAt = (t: number): [number, number] => [0.5 + sway * sin(PI * t) + 0.04 * sin(TAU * t), tall * (0.98 - 0.94 * t)]
    const stem: [number, number][] = []
    for (let t = 0; t <= 1; t += 0.02) stem.push(stemAt(t))
    // The stem's two edges, cut as lines a little apart.
    for (const way of [-1, 1]) {
      const edge: [number, number][] = stem.map(([u, v], i) => {
        const [nu, nv] = stem[Math.min(i + 1, stem.length - 1)]!
        const [pu, pv] = stem[Math.max(i - 1, 0)]!
        const du = nu - pu
        const dv = nv - pv
        const d = Math.sqrt(du * du + dv * dv) || 1
        const off = (gap * 0.55 * (1 - (i / stem.length) * 0.5) * way)
        return [u - (dv / d) * off, v + (du / d) * off]
      })
      cuts.push(...gouged(path(edge), width * 0.9, draw.fork(`stem${way}`), 0.02))
    }
    const leaves = draw.int(5, 7)
    const veins = draw.fork("veins")
    for (let n = 0; n < leaves; n++) {
      const t = 0.14 + (0.8 * n) / leaves
      const [su, sv] = stemAt(t)
      const [nu, nv] = stemAt(t + 0.01)
      const up = [nu - su, nv - sv]
      const heading = Math.sqrt(up[0]! * up[0]! + up[1]! * up[1]!)
      const tu = up[0]! / heading
      const tv = up[1]! / heading
      const side = n % 2 ? 1 : -1
      const spread = veins.between([0.7, 1.05])
      const length = 0.44 * (1 - t * 0.3) * veins.between([0.88, 1.08])
      // The leaf's own axis: off the stem at an angle, toward the tip.
      const du = tu * cos(spread) - tv * sin(spread) * side
      const dv = tu * sin(spread) * side + tv * cos(spread)
      const leaf: [number, number][] = []
      const half = length * 0.26
      for (let i = 0; i <= 24; i++) {
        const s = i / 24
        const wide = sin(PI * s) * half * (1 - 0.3 * s)
        leaf.push([su + du * length * s - dv * wide, sv + dv * length * s + du * wide])
      }
      for (let i = 23; i > 0; i--) {
        const s = i / 24
        const wide = sin(PI * s) * half * (1 - 0.3 * s)
        leaf.push([su + du * length * s + dv * wide, sv + dv * length * s - du * wide])
      }
      // The leaf's outline cut all round.
      cuts.push(stroke([...path(leaf), ...path([leaf[0]!])], width * 0.9))
      // The midrib, and veins off it toward the tip.
      const rib: [number, number][] = []
      for (let s = 0.08; s <= 0.86; s += 0.04) rib.push([su + du * length * s, sv + dv * length * s])
      cuts.push(stroke(path(rib), width * 1.1))
      for (let s = 0.22; s < 0.8; s += 0.14) {
        for (const way of [-1, 1]) {
          const reach = sin(PI * s) * half * 0.8
          const vein: [number, number][] = []
          for (let r = 0.1; r <= 1; r += 0.15) {
            const along = s + r * 0.1
            vein.push([su + du * length * along - dv * reach * r * way, sv + dv * length * along + du * reach * r * way])
          }
          cuts.push(stroke(path(vein), width * 0.8))
        }
      }
    }
  } else if (subject === "waves") {
    solid.push({ type: "polygon", points: outline })
    border()
    // Rows of crests, each cut deep along its line, two thinner lines
    // following it down, and a few flecks of foam cut out at the peaks.
    const rows = draw.int(5, 7)
    const sea = draw.fork("sea")
    const freq = sea.between([7, 11])
    for (let n = 0; n < rows; n++) {
      const base = 0.09 + ((tall - 0.16) * (n + 0.5)) / rows
      const amp = sea.between([0.018, 0.03])
      const phase = sea.next() * TAU + n * 1.3
      const crest = (u: number) => base - Math.abs(sin(freq * u + phase)) * amp * 1.8 + amp
      const line: [number, number][] = []
      for (let u = 0.06; u <= 0.94; u += 0.008) line.push([u, crest(u)])
      cuts.push(...gouged(path(line), width * 1.6, sea, 0.05))
      for (const d of [gap * 1.1, gap * 2]) {
        const under: [number, number][] = []
        for (let u = 0.06; u <= 0.94; u += 0.01) under.push([u, crest(u) + d])
        cuts.push(...gouged(path(under), width * (d > gap * 1.5 ? 0.5 : 0.8), sea, 0.4))
      }
      for (let u = 0.08; u < 0.92; u += 0.01) {
        if (Math.abs(sin(freq * u + phase)) > 0.05 || sea.next() > 0.5) continue
        const [x, y] = at(u + sea.between([-0.01, 0.01]), crest(u) - gap * 0.9)
        cuts.push({ type: "circle", cx: x, cy: y, r: width * sea.between([0.5, 0.9]) })
      }
    }
  } else {
    // The brand's initial standing in ink, and round it the block cut away in
    // level strokes, inside a border.
    solid.push({ type: "polygon", points: outline })
    border()
    const letter = initialOf(frame.seed, draw)
    const scale = 0.7 / CAP
    const left = 0.5 - (letter.advance * scale) / 2
    const top = tall / 2 - (CAP * scale) / 2
    const contours = letter.contours.map((points) => points.map((value, i) => (i % 2 ? top + value * scale : left + value * scale)))
    // Just off the letter, so its edge prints whole.
    const margin = gap * 0.6
    const near = (u: number, v: number) =>
      insideOf(contours, u, v) || insideOf(contours, u + margin, v) || insideOf(contours, u - margin, v) || insideOf(contours, u, v + margin) || insideOf(contours, u, v - margin)
    const field = draw.fork("field")
    for (let v = 0.1; v < tall - 0.09; v += gap * 0.8) {
      let run: [number, number][] = []
      for (let u = 0.08; u <= 0.92; u += 0.006) {
        if (near(u, v)) {
          if (run.length > 2) cuts.push(...gouged(path(run), width * 1.1, field, 0.1))
          run = []
          continue
        }
        run.push([u, v])
      }
      if (run.length > 2) cuts.push(...gouged(path(run), width * 1.1, field, 0.1))
    }
  }

  const piece: Piece = {
    id: "block",
    clip: { type: "polygon", points: outline },
    marks: [ink("inked", solid), paper("cuts", cuts)],
  }
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces: [piece],
    over: [],
    subject: block,
  }
}
